package encryption

type EncryptionContext struct {
	UserID     string
	WorkflowID string
}

type FieldContext struct {
	Encryption EncryptionContext
	FieldPath  string
}

type ArrayFieldContext struct {
	Encryption EncryptionContext
	ArrayName  string
	Alias      string
	FieldPath  string
}

type ContextBinder struct {
	builder *ADBuilder
}

func NewContextBinder() *ContextBinder {
	return &ContextBinder{
		builder: NewADBuilder(),
	}
}

func (cb *ContextBinder) BindLLMField(ctx FieldContext) []byte {
	return cb.builder.BuildForLLMField(ctx.Encryption.UserID, ctx.Encryption.WorkflowID, ctx.FieldPath)
}

func (cb *ContextBinder) BindArrayField(ctx ArrayFieldContext) []byte {
	return cb.builder.BuildForArrayField(
		ctx.Encryption.UserID,
		ctx.Encryption.WorkflowID,
		ctx.ArrayName,
		ctx.Alias,
		ctx.FieldPath,
	)
}
