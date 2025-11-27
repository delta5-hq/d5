package http

import (
	"net/http"
	"testing"
	"time"
)

func TestClientFactory_Create(t *testing.T) {
	factory := NewClientFactory()

	tests := []struct {
		name    string
		timeout time.Duration
	}{
		{
			name:    "30 second timeout",
			timeout: 30 * time.Second,
		},
		{
			name:    "300 second timeout",
			timeout: 300 * time.Second,
		},
		{
			name:    "1 second timeout",
			timeout: 1 * time.Second,
		},
		{
			name:    "zero timeout",
			timeout: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := factory.Create(tt.timeout)

			if client == nil {
				t.Fatal("Create() returned nil client")
			}

			httpClient, ok := client.(*http.Client)
			if !ok {
				t.Fatal("Create() did not return *http.Client")
			}

			if httpClient.Timeout != tt.timeout {
				t.Errorf("Create() timeout = %v, want %v", httpClient.Timeout, tt.timeout)
			}
		})
	}
}

func TestClientFactory_CreateDefault(t *testing.T) {
	factory := NewClientFactory()
	client := factory.CreateDefault()

	if client == nil {
		t.Fatal("CreateDefault() returned nil client")
	}

	httpClient, ok := client.(*http.Client)
	if !ok {
		t.Fatal("CreateDefault() did not return *http.Client")
	}

	expectedTimeout := 30 * time.Second
	if httpClient.Timeout != expectedTimeout {
		t.Errorf("CreateDefault() timeout = %v, want %v", httpClient.Timeout, expectedTimeout)
	}
}

func TestClientFactory_MultipleInstances(t *testing.T) {
	factory := NewClientFactory()

	client1 := factory.Create(30 * time.Second)
	client2 := factory.Create(60 * time.Second)

	if client1 == client2 {
		t.Error("Create() should return different instances for different timeouts")
	}

	httpClient1 := client1.(*http.Client)
	httpClient2 := client2.(*http.Client)

	if httpClient1.Timeout == httpClient2.Timeout {
		t.Error("Different Create() calls should have independent timeout configurations")
	}
}

func TestNewClientFactory(t *testing.T) {
	factory := NewClientFactory()

	if factory == nil {
		t.Fatal("NewClientFactory() returned nil")
	}
}
