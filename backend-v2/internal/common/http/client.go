package http

import (
	"net/http"
	"time"
)

type Client interface {
	Do(*http.Request) (*http.Response, error)
}

type ClientFactory struct{}

func NewClientFactory() *ClientFactory {
	return &ClientFactory{}
}

func (f *ClientFactory) Create(timeout time.Duration) Client {
	return &http.Client{
		Timeout: timeout,
	}
}

func (f *ClientFactory) CreateDefault() Client {
	return f.Create(30 * time.Second)
}
