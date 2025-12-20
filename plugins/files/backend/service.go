package files

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	sdk "github.com/vpanel/sdk"
)

// Service handles file operations
type Service struct {
	log     sdk.Logger
	baseDir string
}

// NewService creates a new file service
func NewService(log sdk.Logger) *Service {
	return &Service{log: log, baseDir: "/"}
}

// expandPath expands ~ to the user's home directory
func (s *Service) expandPath(path string) string {
	if path == "~" {
		home, err := os.UserHomeDir()
		if err != nil {
			return path
		}
		return home
	}
	if strings.HasPrefix(path, "~/") {
		home, err := os.UserHomeDir()
		if err != nil {
			return path
		}
		return filepath.Join(home, path[2:])
	}
	return path
}

// FileInfo represents file information
type FileInfo struct {
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	Size        int64     `json:"size"`
	IsDir       bool      `json:"is_dir"`
	Mode        string    `json:"mode"`
	ModTime     time.Time `json:"mod_time"`
	Permissions string    `json:"permissions"`
	Owner       string    `json:"owner"`
	Group       string    `json:"group"`
}

// List returns directory contents
func (s *Service) List(path string) ([]FileInfo, error) {
	expandedPath := s.expandPath(path)
	entries, err := os.ReadDir(expandedPath)
	if err != nil {
		return nil, err
	}

	files := make([]FileInfo, 0, len(entries))
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}

		// Use the expanded path for the full file path
		filePath := filepath.Join(expandedPath, entry.Name())
		files = append(files, FileInfo{
			Name:        entry.Name(),
			Path:        filePath,
			Size:        info.Size(),
			IsDir:       entry.IsDir(),
			Mode:        info.Mode().String(),
			ModTime:     info.ModTime(),
			Permissions: info.Mode().Perm().String(),
		})
	}

	return files, nil
}

// Read reads file content
func (s *Service) Read(path string) ([]byte, error) {
	return os.ReadFile(s.expandPath(path))
}

// Write writes content to file
func (s *Service) Write(path string, content []byte) error {
	return os.WriteFile(s.expandPath(path), content, 0644)
}

// Mkdir creates a directory
func (s *Service) Mkdir(path string) error {
	return os.MkdirAll(s.expandPath(path), 0755)
}

// Rename renames a file or directory
func (s *Service) Rename(oldPath, newPath string) error {
	return os.Rename(s.expandPath(oldPath), s.expandPath(newPath))
}

// Copy copies a file
func (s *Service) Copy(src, dst string) error {
	source, err := os.Open(s.expandPath(src))
	if err != nil {
		return err
	}
	defer source.Close()

	destination, err := os.Create(s.expandPath(dst))
	if err != nil {
		return err
	}
	defer destination.Close()

	_, err = io.Copy(destination, source)
	return err
}

// Move moves a file
func (s *Service) Move(src, dst string) error {
	return os.Rename(s.expandPath(src), s.expandPath(dst))
}

// Delete deletes a file or directory
func (s *Service) Delete(path string) error {
	return os.RemoveAll(s.expandPath(path))
}

// GetPermissions returns file permissions
func (s *Service) GetPermissions(path string) (*FileInfo, error) {
	expandedPath := s.expandPath(path)
	info, err := os.Stat(expandedPath)
	if err != nil {
		return nil, err
	}

	return &FileInfo{
		Name:        info.Name(),
		Path:        expandedPath,
		Size:        info.Size(),
		IsDir:       info.IsDir(),
		Mode:        info.Mode().String(),
		ModTime:     info.ModTime(),
		Permissions: info.Mode().Perm().String(),
	}, nil
}

// SetPermissions sets file permissions
func (s *Service) SetPermissions(path string, mode os.FileMode) error {
	return os.Chmod(s.expandPath(path), mode)
}

// Search searches for files
func (s *Service) Search(path, pattern string) ([]FileInfo, error) {
	var results []FileInfo
	expandedPath := s.expandPath(path)

	err := filepath.Walk(expandedPath, func(p string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}

		if matched, _ := filepath.Match(pattern, info.Name()); matched {
			results = append(results, FileInfo{
				Name:    info.Name(),
				Path:    p,
				Size:    info.Size(),
				IsDir:   info.IsDir(),
				ModTime: info.ModTime(),
			})
		}

		return nil
	})

	return results, err
}

// Compress compresses files
func (s *Service) Compress(paths []string, destPath, format string) error {
	// Expand all paths
	expandedPaths := make([]string, len(paths))
	for i, p := range paths {
		expandedPaths[i] = s.expandPath(p)
	}
	expandedDest := s.expandPath(destPath)

	switch format {
	case "zip":
		return s.createZip(expandedPaths, expandedDest)
	case "tar.gz":
		return s.createTarGz(expandedPaths, expandedDest)
	default:
		return s.createZip(expandedPaths, expandedDest)
	}
}

func (s *Service) createZip(paths []string, destPath string) error {
	file, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := zip.NewWriter(file)
	defer writer.Close()

	for _, path := range paths {
		if err := s.addToZip(writer, path, ""); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) addToZip(writer *zip.Writer, path, base string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}

	header, err := zip.FileInfoHeader(info)
	if err != nil {
		return err
	}

	if base != "" {
		header.Name = filepath.Join(base, info.Name())
	} else {
		header.Name = info.Name()
	}

	if info.IsDir() {
		header.Name += "/"
		_, err = writer.CreateHeader(header)
		if err != nil {
			return err
		}

		entries, err := os.ReadDir(path)
		if err != nil {
			return err
		}

		for _, entry := range entries {
			if err := s.addToZip(writer, filepath.Join(path, entry.Name()), header.Name); err != nil {
				return err
			}
		}
	} else {
		header.Method = zip.Deflate
		w, err := writer.CreateHeader(header)
		if err != nil {
			return err
		}

		file, err := os.Open(path)
		if err != nil {
			return err
		}
		defer file.Close()

		_, err = io.Copy(w, file)
		return err
	}

	return nil
}

func (s *Service) createTarGz(paths []string, destPath string) error {
	file, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer file.Close()

	gzWriter := gzip.NewWriter(file)
	defer gzWriter.Close()

	tarWriter := tar.NewWriter(gzWriter)
	defer tarWriter.Close()

	for _, path := range paths {
		if err := s.addToTar(tarWriter, path, ""); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) addToTar(writer *tar.Writer, path, base string) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}

	header, err := tar.FileInfoHeader(info, "")
	if err != nil {
		return err
	}

	if base != "" {
		header.Name = filepath.Join(base, info.Name())
	} else {
		header.Name = info.Name()
	}

	if err := writer.WriteHeader(header); err != nil {
		return err
	}

	if info.IsDir() {
		entries, err := os.ReadDir(path)
		if err != nil {
			return err
		}

		for _, entry := range entries {
			if err := s.addToTar(writer, filepath.Join(path, entry.Name()), header.Name); err != nil {
				return err
			}
		}
	} else {
		file, err := os.Open(path)
		if err != nil {
			return err
		}
		defer file.Close()

		_, err = io.Copy(writer, file)
		return err
	}

	return nil
}

// Decompress decompresses an archive
func (s *Service) Decompress(archivePath, destPath string) error {
	expandedArchive := s.expandPath(archivePath)
	expandedDest := s.expandPath(destPath)

	if strings.HasSuffix(expandedArchive, ".zip") {
		return s.extractZip(expandedArchive, expandedDest)
	} else if strings.HasSuffix(expandedArchive, ".tar.gz") || strings.HasSuffix(expandedArchive, ".tgz") {
		return s.extractTarGz(expandedArchive, expandedDest)
	}
	return s.extractZip(expandedArchive, expandedDest)
}

func (s *Service) extractZip(archivePath, destPath string) error {
	reader, err := zip.OpenReader(archivePath)
	if err != nil {
		return err
	}
	defer reader.Close()

	for _, file := range reader.File {
		path := filepath.Join(destPath, file.Name)

		if file.FileInfo().IsDir() {
			os.MkdirAll(path, 0755)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			return err
		}

		dstFile, err := os.Create(path)
		if err != nil {
			return err
		}

		srcFile, err := file.Open()
		if err != nil {
			dstFile.Close()
			return err
		}

		_, err = io.Copy(dstFile, srcFile)
		srcFile.Close()
		dstFile.Close()

		if err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) extractTarGz(archivePath, destPath string) error {
	file, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer file.Close()

	gzReader, err := gzip.NewReader(file)
	if err != nil {
		return err
	}
	defer gzReader.Close()

	tarReader := tar.NewReader(gzReader)

	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		path := filepath.Join(destPath, header.Name)

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(path, 0755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
				return err
			}

			dstFile, err := os.Create(path)
			if err != nil {
				return err
			}

			if _, err := io.Copy(dstFile, tarReader); err != nil {
				dstFile.Close()
				return err
			}
			dstFile.Close()
		}
	}

	return nil
}
