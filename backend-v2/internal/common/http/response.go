package http

import (
	"io"
	"net/http"
)

type ResponseReader struct{}

func NewResponseReader() *ResponseReader {
	return &ResponseReader{}
}

func (r *ResponseReader) ReadAll(resp *http.Response) ([]byte, error) {
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func (r *ResponseReader) ReadWithStatus(resp *http.Response) ([]byte, int, error) {
	body, err := r.ReadAll(resp)
	return body, resp.StatusCode, err
}
