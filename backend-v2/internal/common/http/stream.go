package http

import (
	"bufio"
	"io"
	"net/http"
)

type ResponseStreamer struct{}

func NewResponseStreamer() *ResponseStreamer {
	return &ResponseStreamer{}
}

func (s *ResponseStreamer) Stream(resp *http.Response, writer *bufio.Writer) error {
	defer resp.Body.Close()

	buf := make([]byte, 4096)
	for {
		n, readErr := resp.Body.Read(buf)

		if n > 0 {
			if _, writeErr := writer.Write(buf[:n]); writeErr != nil {
				return writeErr
			}

			if flushErr := writer.Flush(); flushErr != nil {
				return flushErr
			}
		}

		if readErr != nil {
			if readErr == io.EOF {
				return nil
			}
			return readErr
		}
	}
}
