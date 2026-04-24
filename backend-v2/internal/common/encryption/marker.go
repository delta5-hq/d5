package encryption

import "strings"

const encryptedPrefix = "__encrypted__"

// Marker handles encryption state marking for idempotent operations.
// Marked values are skipped during encryption to prevent double-encryption.
type Marker struct{}

// NewMarker creates a marker instance.
func NewMarker() *Marker {
	return &Marker{}
}

// Mark adds the encryption prefix to ciphertext.
func (m *Marker) Mark(ciphertext string) string {
	return encryptedPrefix + ciphertext
}

// IsMarked checks if value already has encryption prefix.
func (m *Marker) IsMarked(value string) bool {
	return strings.HasPrefix(value, encryptedPrefix)
}

// Unmark removes the encryption prefix from marked ciphertext.
func (m *Marker) Unmark(markedValue string) string {
	return strings.TrimPrefix(markedValue, encryptedPrefix)
}
