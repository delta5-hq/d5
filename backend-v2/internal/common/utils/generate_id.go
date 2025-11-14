package utils

import (
	"github.com/matoous/go-nanoid/v2"
)

/* Match Node.js entropy-string behavior: 11 chars for 100k workflows */
const alphabet = "2346789bdfghjmnpqrtBDFGHJLMNPQRT"

func GenerateID () string {
	return gonanoid.MustGenerate(alphabet, 11)
} 