package http

import (
	"bufio"
	"bytes"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestResponseStreamer_Stream_Success(t *testing.T) {
	streamer := NewResponseStreamer()

	testData := "line1\nline2\nline3"
	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(testData)),
	}

	var output bytes.Buffer
	writer := bufio.NewWriter(&output)

	err := streamer.Stream(resp, writer)
	if err != nil {
		t.Fatalf("Stream() error = %v, want nil", err)
	}

	if output.String() != testData {
		t.Errorf("Stream() output = %q, want %q", output.String(), testData)
	}
}

func TestResponseStreamer_Stream_EmptyBody(t *testing.T) {
	streamer := NewResponseStreamer()

	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader("")),
	}

	var output bytes.Buffer
	writer := bufio.NewWriter(&output)

	err := streamer.Stream(resp, writer)
	if err != nil {
		t.Fatalf("Stream() error = %v, want nil", err)
	}

	if output.Len() != 0 {
		t.Errorf("Stream() output length = %v, want 0", output.Len())
	}
}

func TestResponseStreamer_Stream_LargeData(t *testing.T) {
	streamer := NewResponseStreamer()

	largeData := strings.Repeat("x", 100000)
	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(largeData)),
	}

	var output bytes.Buffer
	writer := bufio.NewWriter(&output)

	err := streamer.Stream(resp, writer)
	if err != nil {
		t.Fatalf("Stream() error = %v, want nil", err)
	}

	if output.String() != largeData {
		t.Errorf("Stream() output length = %v, want %v", output.Len(), len(largeData))
	}
}

func TestResponseStreamer_Stream_MultipleChunks(t *testing.T) {
	streamer := NewResponseStreamer()

	chunks := []string{"chunk1", "chunk2", "chunk3", "chunk4"}
	data := strings.Join(chunks, "")

	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(data)),
	}

	var output bytes.Buffer
	writer := bufio.NewWriter(&output)

	err := streamer.Stream(resp, writer)
	if err != nil {
		t.Fatalf("Stream() error = %v, want nil", err)
	}

	if output.String() != data {
		t.Errorf("Stream() output = %q, want %q", output.String(), data)
	}
}

func TestResponseStreamer_Stream_ReadError(t *testing.T) {
	streamer := NewResponseStreamer()

	expectedErr := io.ErrUnexpectedEOF
	resp := &http.Response{
		Body: &errorReader{err: expectedErr},
	}

	var output bytes.Buffer
	writer := bufio.NewWriter(&output)

	err := streamer.Stream(resp, writer)
	if err != expectedErr {
		t.Errorf("Stream() error = %v, want %v", err, expectedErr)
	}
}

func TestResponseStreamer_Stream_WriteError(t *testing.T) {
	streamer := NewResponseStreamer()

	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader("test data")),
	}

	expectedErr := io.ErrShortWrite
	failingWriter := &failingIOWriter{err: expectedErr}
	writer := bufio.NewWriter(failingWriter)

	err := streamer.Stream(resp, writer)
	if err != expectedErr {
		t.Errorf("Stream() error = %v, want %v", err, expectedErr)
	}
}

func TestResponseStreamer_Stream_PartialRead(t *testing.T) {
	streamer := NewResponseStreamer()

	data := strings.Repeat("x", 5000)
	resp := &http.Response{
		Body: io.NopCloser(strings.NewReader(data)),
	}

	var output bytes.Buffer
	writer := bufio.NewWriter(&output)

	err := streamer.Stream(resp, writer)
	if err != nil {
		t.Fatalf("Stream() error = %v, want nil", err)
	}

	if output.String() != data {
		t.Errorf("Stream() output length = %v, want %v", output.Len(), len(data))
	}
}

func TestResponseStreamer_Stream_BinaryData(t *testing.T) {
	streamer := NewResponseStreamer()

	binaryData := []byte{0x00, 0x01, 0xFF, 0xFE, 0x89, 0x50, 0x4E, 0x47}
	resp := &http.Response{
		Body: io.NopCloser(bytes.NewReader(binaryData)),
	}

	var output bytes.Buffer
	writer := bufio.NewWriter(&output)

	err := streamer.Stream(resp, writer)
	if err != nil {
		t.Fatalf("Stream() error = %v, want nil", err)
	}

	if !bytes.Equal(output.Bytes(), binaryData) {
		t.Error("Stream() did not preserve binary data")
	}
}

func TestResponseStreamer_Stream_ClosesBodyOnSuccess(t *testing.T) {
	streamer := NewResponseStreamer()

	closed := false
	resp := &http.Response{
		Body: &testReadCloser{
			Reader: strings.NewReader("success"),
			onClose: func() {
				closed = true
			},
		},
	}

	var output bytes.Buffer
	writer := bufio.NewWriter(&output)

	err := streamer.Stream(resp, writer)
	if err != nil {
		t.Fatalf("Stream() error = %v, want nil", err)
	}

	if !closed {
		t.Error("Stream() did not close body on success")
	}
}

func TestResponseStreamer_Stream_ClosesBodyOnReadError(t *testing.T) {
	streamer := NewResponseStreamer()

	closed := false
	resp := &http.Response{
		Body: &testReadCloser{
			Reader: &errorReader{err: io.ErrUnexpectedEOF},
			onClose: func() {
				closed = true
			},
		},
	}

	var output bytes.Buffer
	writer := bufio.NewWriter(&output)

	_ = streamer.Stream(resp, writer)

	if !closed {
		t.Error("Stream() did not close body on read error")
	}
}

func TestResponseStreamer_Stream_ClosesBodyOnWriteError(t *testing.T) {
	streamer := NewResponseStreamer()

	closed := false
	resp := &http.Response{
		Body: &testReadCloser{
			Reader: strings.NewReader("data"),
			onClose: func() {
				closed = true
			},
		},
	}

	failingWriter := &failingIOWriter{err: io.ErrShortWrite}
	writer := bufio.NewWriter(failingWriter)

	_ = streamer.Stream(resp, writer)

	if !closed {
		t.Error("Stream() did not close body on write error")
	}
}

func TestNewResponseStreamer(t *testing.T) {
	streamer := NewResponseStreamer()

	if streamer == nil {
		t.Fatal("NewResponseStreamer() returned nil")
	}
}

type testReadCloser struct {
	io.Reader
	onClose func()
}

func (t *testReadCloser) Close() error {
	if t.onClose != nil {
		t.onClose()
	}
	return nil
}

type errorReader struct {
	err error
}

func (e *errorReader) Read([]byte) (int, error) {
	return 0, e.err
}

func (e *errorReader) Close() error {
	return nil
}

type failingIOWriter struct {
	err error
}

func (f *failingIOWriter) Write([]byte) (int, error) {
	return 0, f.err
}
