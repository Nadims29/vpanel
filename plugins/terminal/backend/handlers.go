package terminal

import (
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Control message prefix for resize commands
const resizePrefix = '\x01'

func (p *Plugin) websocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		p.Log().Error("WebSocket upgrade failed", "error", err)
		return
	}
	defer conn.Close()

	// Parse initial terminal size from query parameters
	cols, _ := strconv.Atoi(c.DefaultQuery("cols", "80"))
	rows, _ := strconv.Atoi(c.DefaultQuery("rows", "24"))
	if cols <= 0 {
		cols = 80
	}
	if rows <= 0 {
		rows = 24
	}

	sessionID := uuid.New().String()
	session, err := p.service.CreateSession(sessionID, cols, rows)
	if err != nil {
		p.Log().Error("Failed to create terminal session", "error", err)
		conn.WriteMessage(websocket.TextMessage, []byte("Failed to create session: "+err.Error()))
		return
	}
	defer p.service.CloseSession(sessionID)

	// Channel to signal connection close
	done := make(chan struct{})

	// Read from PTY and send to WebSocket
	go func() {
		buf := make([]byte, 4096)
		for {
			select {
			case <-done:
				return
			default:
				n, err := session.PTY.Read(buf)
				if err != nil {
					if err != io.EOF {
						p.Log().Debug("PTY read error", "error", err)
					}
					return
				}
				if err := conn.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
					p.Log().Debug("WebSocket write error", "error", err)
					return
				}
			}
		}
	}()

	// Read from WebSocket and write to PTY
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				p.Log().Debug("WebSocket read error", "error", err)
			}
			close(done)
			return
		}

		// Check for resize message (starts with \x01)
		if len(msg) > 0 && msg[0] == resizePrefix {
			// Parse resize message: \x01<cols>;<rows>
			resizeData := string(msg[1:])
			parts := strings.Split(resizeData, ";")
			if len(parts) == 2 {
				newCols, err1 := strconv.Atoi(parts[0])
				newRows, err2 := strconv.Atoi(parts[1])
				if err1 == nil && err2 == nil && newCols > 0 && newRows > 0 {
					if err := p.service.ResizeSession(sessionID, newCols, newRows); err != nil {
						p.Log().Debug("Failed to resize terminal", "error", err)
					}
				}
			}
			continue
		}

		// Regular input - write to PTY
		if _, err := session.PTY.Write(msg); err != nil {
			p.Log().Debug("PTY write error", "error", err)
			close(done)
			return
		}
	}
}

func (p *Plugin) listSessions(c *gin.Context) {
	sessions := p.service.ListSessions()
	c.JSON(http.StatusOK, gin.H{"success": true, "data": sessions})
}

func (p *Plugin) closeSession(c *gin.Context) {
	id := c.Param("id")
	if err := p.service.CloseSession(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Session closed"})
}
