import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, X, Maximize2, Minimize2, Settings } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { cn } from '@/utils/cn';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css';
import { useAuthStore } from '@/stores/auth';

interface TerminalTab {
  id: string;
  title: string;
}

function TerminalPane({ tabId, isActive }: { tabId: string; isActive: boolean }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    // Create xterm instance with Retina optimization
    // Font size 12px is common for terminals, aligned to 4px grid
    const xterm = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 12,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontWeight: '400',
      fontWeightBold: '600',
      letterSpacing: 0,
      lineHeight: 1.0,
      theme: {
        background: '#0a0a0a',
        foreground: '#e5e5e5',
        cursor: '#22c55e',
        cursorAccent: '#0a0a0a',
        selectionBackground: '#3b82f680',
        black: '#171717',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e5e5e5',
        brightBlack: '#525252',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      allowTransparency: false, // Disable for better rendering performance
      scrollback: 10000,
      // Retina optimization options
      allowProposedApi: true,
      windowOptions: {
        fullscreenWin: false,
        maximizeWin: false,
        minimizeWin: false,
        raiseWin: false,
        refreshWin: false,
        restoreWin: false,
        setWinLines: false,
        setWinPosition: false,
        setWinSizeChars: false,
        setWinSizePixels: false,
        setWinTitle: false,
      },
    });

    // Add addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    // Open terminal in container
    xterm.open(terminalRef.current);
    
    // Try to load WebGL addon for better Retina rendering
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      xterm.loadAddon(webglAddon);
      console.log('WebGL renderer enabled for better Retina display');
    } catch (e) {
      console.warn('WebGL not available, using canvas renderer');
    }
    
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Connect WebSocket
    connectWebSocket(xterm, fitAddon);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId]);

  // Connect to WebSocket
  const connectWebSocket = useCallback((xterm: XTerm, _fitAddon: FitAddon) => {
    const token = useAuthStore.getState().token;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    const cols = xterm.cols;
    const rows = xterm.rows;
    
    const params = new URLSearchParams();
    params.set('cols', String(cols));
    params.set('rows', String(rows));
    if (token) {
      params.set('token', token);
    }
    
    const url = `${protocol}//${host}/api/terminal/ws?${params.toString()}`;
    console.log('Connecting to terminal WebSocket:', url);
    
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Terminal WebSocket connected');
      setConnected(true);
      setError(null);
      
      // Focus terminal
      xterm.focus();
    };

    ws.onmessage = (event) => {
      if (event.data instanceof Blob) {
        event.data.text().then((text) => {
          xterm.write(text);
        });
      } else if (typeof event.data === 'string') {
        xterm.write(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        const decoder = new TextDecoder();
        xterm.write(decoder.decode(event.data));
      }
    };

    ws.onerror = (event) => {
      console.error('Terminal WebSocket error:', event);
      setError('WebSocket connection error');
      setConnected(false);
    };

    ws.onclose = (event) => {
      console.log('Terminal WebSocket closed:', event.code, event.reason);
      setConnected(false);
      if (event.code !== 1000) {
        setError(`Connection closed: ${event.reason || 'Unknown error'}`);
      }
    };

    // Send terminal input to WebSocket
    xterm.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Handle terminal resize
    xterm.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        // Send resize message: \x01<cols>;<rows>
        ws.send(`\x01${cols};${rows}`);
      }
    });
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (e) {
          // Ignore resize errors
        }
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Focus terminal when tab becomes active
  useEffect(() => {
    if (isActive && xtermRef.current) {
      xtermRef.current.focus();
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch (e) {
          // Ignore
        }
      }
    }
  }, [isActive]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Connection status bar */}
      {(!connected || error) && (
        <div className={cn(
          "px-3 py-1 text-xs",
          error ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"
        )}>
          {error || 'Connecting to terminal...'}
        </div>
      )}
      
      {/* Terminal container with pixel-perfect alignment */}
      <div 
        ref={terminalRef} 
        className="flex-1 w-full terminal-container"
        style={{ 
          padding: '4px',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        }}
      />
      
      {/* Style for xterm canvas optimization */}
      <style>{`
        .terminal-container .xterm {
          padding: 0;
        }
        .terminal-container .xterm-viewport {
          overflow-y: auto !important;
        }
        .terminal-container .xterm-screen {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
        }
        .terminal-container canvas {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
        }
      `}</style>
    </div>
  );
}

export default function Terminal() {
  const [tabs, setTabs] = useState<TerminalTab[]>([
    {
      id: '1',
      title: 'Terminal 1',
    }
  ]);
  const [activeTab, setActiveTab] = useState('1');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const addTab = () => {
    const newId = String(Date.now());
    const newTab: TerminalTab = {
      id: newId,
      title: `Terminal ${tabs.length + 1}`,
    };
    setTabs([...tabs, newTab]);
    setActiveTab(newId);
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) return;
    
    const newTabs = tabs.filter((t) => t.id !== id);
    setTabs(newTabs);
    if (activeTab === id) {
      setActiveTab(newTabs[0].id);
    }
  };

  return (
    <div className={cn('flex flex-col', isFullscreen ? 'fixed inset-0 z-50 bg-dark-950' : 'h-[calc(100vh-8rem)]')}>
      {/* Header */}
      {!isFullscreen && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-dark-100">Terminal</h1>
            <p className="text-dark-400">Web-based terminal</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" leftIcon={<Settings className="w-4 h-4" />}>
              Settings
            </Button>
          </div>
        </div>
      )}

      {/* Terminal Card */}
      <Card className={cn('flex-1 flex flex-col overflow-hidden', isFullscreen && 'rounded-none border-0')}>
        {/* Tab bar */}
        <div className="flex items-center bg-dark-900 border-b border-dark-700">
          <div className="flex-1 flex items-center overflow-x-auto">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={cn(
                  'group flex items-center gap-2 px-3 py-2 border-r border-dark-700 cursor-pointer min-w-0',
                  tab.id === activeTab ? 'bg-dark-800 text-dark-100' : 'text-dark-400 hover:bg-dark-800/50'
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                {/* Status indicator */}
                <span className="w-2 h-2 rounded-full flex-shrink-0 bg-green-400" />
                
                {/* Tab info */}
                <div className="flex flex-col min-w-0">
                  <span className="text-sm truncate">{tab.title}</span>
                </div>
                
                {/* Close button */}
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-dark-700 rounded transition-all flex-shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            
            {/* Add new tab button */}
            <button
              onClick={addTab}
              className="p-2 text-dark-400 hover:text-dark-100 hover:bg-dark-800/50 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center gap-1 px-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-dark-400 hover:text-dark-100 hover:bg-dark-700 rounded transition-colors"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Terminal content */}
        <div className="flex-1 overflow-hidden">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn('h-full', tab.id === activeTab ? 'block' : 'hidden')}
            >
              <TerminalPane tabId={tab.id} isActive={tab.id === activeTab} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
