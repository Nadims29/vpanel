package monitor

import (
	"runtime"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/load"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
	sdk "github.com/vpanel/sdk"
	"gorm.io/gorm"
)

// Service handles system monitoring
type Service struct {
	db  *gorm.DB
	log sdk.Logger
}

// NewService creates a new monitor service
func NewService(db *gorm.DB, log sdk.Logger) *Service {
	return &Service{db: db, log: log}
}

// SystemInfo represents system information
type SystemInfo struct {
	Hostname    string `json:"hostname"`
	OS          string `json:"os"`
	Platform    string `json:"platform"`
	PlatformVer string `json:"platform_version"`
	Arch        string `json:"arch"`
	KernelVer   string `json:"kernel_version"`
	Uptime      uint64 `json:"uptime"`
	BootTime    uint64 `json:"boot_time"`
	Procs       uint64 `json:"procs"`
	CPUCores    int    `json:"cpu_cores"`
	CPUModel    string `json:"cpu_model"`
	TotalMemory uint64 `json:"total_memory"`
	TotalDisk   uint64 `json:"total_disk"`
}

// GetSystemInfo returns system information
func (s *Service) GetSystemInfo() (*SystemInfo, error) {
	hostInfo, err := host.Info()
	if err != nil {
		return nil, err
	}

	cpuInfo, _ := cpu.Info()
	cpuModel := ""
	if len(cpuInfo) > 0 {
		cpuModel = cpuInfo[0].ModelName
	}

	memInfo, _ := mem.VirtualMemory()
	diskInfo, _ := disk.Usage("/")

	return &SystemInfo{
		Hostname:    hostInfo.Hostname,
		OS:          hostInfo.OS,
		Platform:    hostInfo.Platform,
		PlatformVer: hostInfo.PlatformVersion,
		Arch:        runtime.GOARCH,
		KernelVer:   hostInfo.KernelVersion,
		Uptime:      hostInfo.Uptime,
		BootTime:    hostInfo.BootTime,
		Procs:       hostInfo.Procs,
		CPUCores:    runtime.NumCPU(),
		CPUModel:    cpuModel,
		TotalMemory: memInfo.Total,
		TotalDisk:   diskInfo.Total,
	}, nil
}

// Metrics represents current system metrics
type Metrics struct {
	CPU     CPUMetrics     `json:"cpu"`
	Memory  MemoryMetrics  `json:"memory"`
	Disk    DiskMetrics    `json:"disk"`
	Network NetworkMetrics `json:"network"`
	Load    LoadMetrics    `json:"load"`
}

// CPUMetrics represents CPU metrics
type CPUMetrics struct {
	UsagePercent float64   `json:"usage_percent"`
	PerCore      []float64 `json:"per_core"`
	Cores        int       `json:"cores"`
}

// MemoryMetrics represents memory metrics
type MemoryMetrics struct {
	Total       uint64  `json:"total"`
	Used        uint64  `json:"used"`
	Available   uint64  `json:"available"`
	UsedPercent float64 `json:"used_percent"`
	SwapTotal   uint64  `json:"swap_total"`
	SwapUsed    uint64  `json:"swap_used"`
}

// DiskMetrics represents disk metrics
type DiskMetrics struct {
	Total       uint64  `json:"total"`
	Used        uint64  `json:"used"`
	Free        uint64  `json:"free"`
	UsedPercent float64 `json:"used_percent"`
	Path        string  `json:"path"`
}

// NetworkMetrics represents network metrics
type NetworkMetrics struct {
	BytesSent   uint64 `json:"bytes_sent"`
	BytesRecv   uint64 `json:"bytes_recv"`
	PacketsSent uint64 `json:"packets_sent"`
	PacketsRecv uint64 `json:"packets_recv"`
}

// LoadMetrics represents load average metrics
type LoadMetrics struct {
	Load1  float64 `json:"load1"`
	Load5  float64 `json:"load5"`
	Load15 float64 `json:"load15"`
}

// GetMetrics returns current system metrics
func (s *Service) GetMetrics() (*Metrics, error) {
	cpuPerCore, err := cpu.Percent(200*time.Millisecond, true)
	if err != nil {
		cpuPerCore = []float64{}
	}

	var cpuPercent []float64
	if len(cpuPerCore) > 0 {
		var total float64
		for _, v := range cpuPerCore {
			total += v
		}
		cpuPercent = []float64{total / float64(len(cpuPerCore))}
	} else {
		cpuPercent = []float64{0}
	}

	memInfo, err := mem.VirtualMemory()
	if err != nil {
		memInfo = &mem.VirtualMemoryStat{}
	}

	swapInfo, _ := mem.SwapMemory()

	diskInfo, err := disk.Usage("/")
	if err != nil {
		diskInfo = &disk.UsageStat{}
	}

	netIO, err := net.IOCounters(false)
	var netMetrics NetworkMetrics
	if err == nil && len(netIO) > 0 {
		netMetrics = NetworkMetrics{
			BytesSent:   netIO[0].BytesSent,
			BytesRecv:   netIO[0].BytesRecv,
			PacketsSent: netIO[0].PacketsSent,
			PacketsRecv: netIO[0].PacketsRecv,
		}
	}

	loadInfo, err := load.Avg()
	var loadMetrics LoadMetrics
	if err == nil {
		loadMetrics = LoadMetrics{
			Load1:  loadInfo.Load1,
			Load5:  loadInfo.Load5,
			Load15: loadInfo.Load15,
		}
	}

	return &Metrics{
		CPU: CPUMetrics{
			UsagePercent: cpuPercent[0],
			PerCore:      cpuPerCore,
			Cores:        runtime.NumCPU(),
		},
		Memory: MemoryMetrics{
			Total:       memInfo.Total,
			Used:        memInfo.Used,
			Available:   memInfo.Available,
			UsedPercent: memInfo.UsedPercent,
			SwapTotal:   swapInfo.Total,
			SwapUsed:    swapInfo.Used,
		},
		Disk: DiskMetrics{
			Total:       diskInfo.Total,
			Used:        diskInfo.Used,
			Free:        diskInfo.Free,
			UsedPercent: diskInfo.UsedPercent,
			Path:        "/",
		},
		Network: netMetrics,
		Load:    loadMetrics,
	}, nil
}

// ProcessInfo represents process information
type ProcessInfo struct {
	PID        int32   `json:"pid"`
	Name       string  `json:"name"`
	Status     string  `json:"status"`
	Username   string  `json:"username"`
	CPUPercent float64 `json:"cpu_percent"`
	MemPercent float32 `json:"mem_percent"`
	Memory     uint64  `json:"memory"`
	CreateTime int64   `json:"create_time"`
	Command    string  `json:"command"`
}

// GetProcesses returns list of processes
func (s *Service) GetProcesses() ([]ProcessInfo, error) {
	procs, err := process.Processes()
	if err != nil {
		return nil, err
	}

	result := make([]ProcessInfo, 0, len(procs))
	for _, p := range procs {
		name, _ := p.Name()
		status, _ := p.Status()
		username, _ := p.Username()
		cpuPercent, _ := p.CPUPercent()
		memPercent, _ := p.MemoryPercent()
		memInfo, _ := p.MemoryInfo()
		createTime, _ := p.CreateTime()
		cmdline, _ := p.Cmdline()

		var memory uint64
		if memInfo != nil {
			memory = memInfo.RSS
		}

		statusStr := ""
		if len(status) > 0 {
			statusStr = status[0]
		}

		result = append(result, ProcessInfo{
			PID:        p.Pid,
			Name:       name,
			Status:     statusStr,
			Username:   username,
			CPUPercent: cpuPercent,
			MemPercent: memPercent,
			Memory:     memory,
			CreateTime: createTime,
			Command:    cmdline,
		})
	}

	return result, nil
}

// KillProcess kills a process by PID
func (s *Service) KillProcess(pid int32) error {
	p, err := process.NewProcess(pid)
	if err != nil {
		return err
	}
	return p.Kill()
}
