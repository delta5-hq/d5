package constants

type AccessRole string

var (
	Owner       AccessRole = "owner"
	Contributor AccessRole = "contributor"
	Reader      AccessRole = "reader"
)

type SubjectType string

const (
	User  SubjectType = "user"
	Group SubjectType = "group"
	Mail  SubjectType = "mail"
)

type Role string

const (
	Subscriber     Role = "subscriber"
	Org_subscriber Role = "org_subscriber"
	Customer       Role = "customer"
	Administrator  Role = "administrator"
)
