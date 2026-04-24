package encryption

import (
	"encoding/binary"
)

const (
	IntegrationsCollection = "integrations"
)

type ADBuilder struct{}

func NewADBuilder() *ADBuilder {
	return &ADBuilder{}
}

func (b *ADBuilder) BuildForLLMField(userID, workflowID, fieldPath string) []byte {
	return b.build(IntegrationsCollection, userID, workflowID, fieldPath)
}

func (b *ADBuilder) BuildForArrayField(userID, workflowID, arrayName, alias, fieldPath string) []byte {
	return b.build(IntegrationsCollection, userID, workflowID, arrayName, alias, fieldPath)
}

func (b *ADBuilder) build(parts ...string) []byte {
	totalSize := 0
	for _, part := range parts {
		totalSize += 4 + len(part)
	}

	buffer := make([]byte, 0, totalSize)

	for _, part := range parts {
		partBytes := []byte(part)
		lengthBytes := make([]byte, 4)
		binary.BigEndian.PutUint32(lengthBytes, uint32(len(partBytes)))

		buffer = append(buffer, lengthBytes...)
		buffer = append(buffer, partBytes...)
	}

	return buffer
}
