package http

import (
	"bytes"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestResponseReader_ReadAll(t *testing.T) {
	reader := NewResponseReader()

	tests := []struct {
		name     string
		body     string
		wantBody string
		wantErr  bool
	}{
		{
			name:     "simple text response",
			body:     "Hello, World!",
			wantBody: "Hello, World!",
			wantErr:  false,
		},
		{
			name:     "json response",
			body:     `{"message":"success","data":{"id":123}}`,
			wantBody: `{"message":"success","data":{"id":123}}`,
			wantErr:  false,
		},
		{
			name:     "empty response",
			body:     "",
			wantBody: "",
			wantErr:  false,
		},
		{
			name:     "large response",
			body:     strings.Repeat("a", 10000),
			wantBody: strings.Repeat("a", 10000),
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := &http.Response{
				Body: io.NopCloser(strings.NewReader(tt.body)),
			}

			body, err := reader.ReadAll(resp)

			if (err != nil) != tt.wantErr {
				t.Errorf("ReadAll() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if string(body) != tt.wantBody {
				t.Errorf("ReadAll() body = %v, want %v", string(body), tt.wantBody)
			}
		})
	}
}

func TestResponseReader_ReadWithStatus(t *testing.T) {
	reader := NewResponseReader()

	tests := []struct {
		name       string
		body       string
		statusCode int
		wantBody   string
		wantStatus int
		wantErr    bool
	}{
		{
			name:       "200 OK response",
			body:       "success",
			statusCode: 200,
			wantBody:   "success",
			wantStatus: 200,
			wantErr:    false,
		},
		{
			name:       "404 Not Found",
			body:       `{"error":"not found"}`,
			statusCode: 404,
			wantBody:   `{"error":"not found"}`,
			wantStatus: 404,
			wantErr:    false,
		},
		{
			name:       "500 Internal Server Error",
			body:       "internal error",
			statusCode: 500,
			wantBody:   "internal error",
			wantStatus: 500,
			wantErr:    false,
		},
		{
			name:       "201 Created with empty body",
			body:       "",
			statusCode: 201,
			wantBody:   "",
			wantStatus: 201,
			wantErr:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := &http.Response{
				Body:       io.NopCloser(strings.NewReader(tt.body)),
				StatusCode: tt.statusCode,
			}

			body, status, err := reader.ReadWithStatus(resp)

			if (err != nil) != tt.wantErr {
				t.Errorf("ReadWithStatus() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if string(body) != tt.wantBody {
				t.Errorf("ReadWithStatus() body = %v, want %v", string(body), tt.wantBody)
			}

			if status != tt.wantStatus {
				t.Errorf("ReadWithStatus() status = %v, want %v", status, tt.wantStatus)
			}
		})
	}
}

func TestResponseReader_BodyAutoClose(t *testing.T) {
	reader := NewResponseReader()

	closeChecker := &closeCheckReader{
		Reader: strings.NewReader("test body"),
		closed: false,
	}

	resp := &http.Response{
		Body: closeChecker,
	}

	_, err := reader.ReadAll(resp)
	if err != nil {
		t.Fatalf("ReadAll() error = %v", err)
	}

	if !closeChecker.closed {
		t.Error("ReadAll() should close response body")
	}
}

func TestResponseReader_ReadWithStatus_BodyAutoClose(t *testing.T) {
	reader := NewResponseReader()

	closeChecker := &closeCheckReader{
		Reader: strings.NewReader("test body"),
		closed: false,
	}

	resp := &http.Response{
		Body:       closeChecker,
		StatusCode: 200,
	}

	_, _, err := reader.ReadWithStatus(resp)
	if err != nil {
		t.Fatalf("ReadWithStatus() error = %v", err)
	}

	if !closeChecker.closed {
		t.Error("ReadWithStatus() should close response body")
	}
}

func TestResponseReader_BinaryData(t *testing.T) {
	reader := NewResponseReader()

	binaryData := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}
	resp := &http.Response{
		Body: io.NopCloser(bytes.NewReader(binaryData)),
	}

	body, err := reader.ReadAll(resp)
	if err != nil {
		t.Fatalf("ReadAll() error = %v", err)
	}

	if !bytes.Equal(body, binaryData) {
		t.Errorf("ReadAll() should preserve binary data")
	}
}

func TestResponseReader_UTF8Content(t *testing.T) {
	reader := NewResponseReader()

	utf8Content := "Hello 世界 🌍 Привет"
	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(utf8Content)),
	}

	body, err := reader.ReadAll(resp)
	if err != nil {
		t.Fatalf("ReadAll() error = %v", err)
	}

	if string(body) != utf8Content {
		t.Errorf("ReadAll() should preserve UTF-8 content")
	}
}

func TestNewResponseReader(t *testing.T) {
	reader := NewResponseReader()

	if reader == nil {
		t.Fatal("NewResponseReader() returned nil")
	}
}

func TestResponseReader_ConcurrentReads(t *testing.T) {
	reader := NewResponseReader()

	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func(index int) {
			resp := &http.Response{
				Body:       io.NopCloser(strings.NewReader("concurrent test")),
				StatusCode: 200,
			}

			_, _, err := reader.ReadWithStatus(resp)
			if err != nil {
				t.Errorf("Concurrent ReadWithStatus() failed: %v", err)
			}
			done <- true
		}(i)
	}

	for i := 0; i < 10; i++ {
		<-done
	}
}

type closeCheckReader struct {
	io.Reader
	closed bool
}

func (c *closeCheckReader) Close() error {
	c.closed = true
	return nil
}
