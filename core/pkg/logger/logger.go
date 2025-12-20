package logger

import (
	"os"

	sdk "github.com/vpanel/sdk"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Config holds logger configuration
type Config struct {
	Level      string
	Format     string
	OutputPath string
}

// Logger wraps zap.SugaredLogger and implements sdk.Logger
type Logger struct {
	*zap.SugaredLogger
}

// New creates a new Logger instance
func New(cfg Config) *Logger {
	var level zapcore.Level
	switch cfg.Level {
	case "debug":
		level = zapcore.DebugLevel
	case "info":
		level = zapcore.InfoLevel
	case "warn":
		level = zapcore.WarnLevel
	case "error":
		level = zapcore.ErrorLevel
	default:
		level = zapcore.InfoLevel
	}

	encoderConfig := zapcore.EncoderConfig{
		TimeKey:        "time",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		MessageKey:     "msg",
		StacktraceKey:  "stacktrace",
		LineEnding:     zapcore.DefaultLineEnding,
		EncodeLevel:    zapcore.LowercaseLevelEncoder,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.SecondsDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	}

	var encoder zapcore.Encoder
	if cfg.Format == "console" {
		encoder = zapcore.NewConsoleEncoder(encoderConfig)
	} else {
		encoder = zapcore.NewJSONEncoder(encoderConfig)
	}

	var writeSyncer zapcore.WriteSyncer
	if cfg.OutputPath != "" && cfg.OutputPath != "stdout" {
		file, err := os.OpenFile(cfg.OutputPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			writeSyncer = zapcore.AddSync(os.Stdout)
		} else {
			writeSyncer = zapcore.NewMultiWriteSyncer(
				zapcore.AddSync(os.Stdout),
				zapcore.AddSync(file),
			)
		}
	} else {
		writeSyncer = zapcore.AddSync(os.Stdout)
	}

	core := zapcore.NewCore(encoder, writeSyncer, level)
	logger := zap.New(core, zap.AddCaller(), zap.AddCallerSkip(1))

	return &Logger{logger.Sugar()}
}

// Debug logs a debug message (implements sdk.Logger)
func (l *Logger) Debug(msg string, args ...interface{}) {
	l.SugaredLogger.Debugw(msg, args...)
}

// Info logs an info message (implements sdk.Logger)
func (l *Logger) Info(msg string, args ...interface{}) {
	l.SugaredLogger.Infow(msg, args...)
}

// Warn logs a warning message (implements sdk.Logger)
func (l *Logger) Warn(msg string, args ...interface{}) {
	l.SugaredLogger.Warnw(msg, args...)
}

// Error logs an error message (implements sdk.Logger)
func (l *Logger) Error(msg string, args ...interface{}) {
	l.SugaredLogger.Errorw(msg, args...)
}

// Fatal logs a fatal message and exits
func (l *Logger) Fatal(msg string, args ...interface{}) {
	l.SugaredLogger.Fatalw(msg, args...)
}

// Sync flushes any buffered log entries
func (l *Logger) Sync() error {
	return l.SugaredLogger.Sync()
}

// Ensure Logger implements sdk.Logger
var _ sdk.Logger = (*Logger)(nil)
