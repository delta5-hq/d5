package models

import (
	"time"
)

type UserFieldsOfWork struct {
	Pupil      string `json:"pupil,omitempty" bson:"pupil,omitempty"`
	Student    string `json:"student,omitempty" bson:"student,omitempty"`
	Researcher string `json:"researcher,omitempty" bson:"researcher,omitempty"`
	Consultant string `json:"consultant,omitempty" bson:"consultant,omitempty"`
	Employee   string `json:"employee,omitempty" bson:"employee,omitempty"`
	Freelancer string `json:"freelancer,omitempty" bson:"freelancer,omitempty"`
	Founder    string `json:"founder,omitempty" bson:"founder,omitempty"`
	Other      string `json:"other,omitempty" bson:"other,omitempty"`
}

type UserMetaStore struct {
	WhatFor        string           `json:"whatFor,omitempty" bson:"whatFor,omitempty"`
	FieldsOfWork   UserFieldsOfWork `json:"fieldsOfWork,omitempty" bson:"fieldsOfWork,omitempty"`
	StudyPhase     string           `json:"studyPhase,omitempty" bson:"studyPhase,omitempty"`
	ResearcherType string           `json:"researcherType,omitempty" bson:"researcherType,omitempty"`
	ConsultantType string           `json:"consultantType,omitempty" bson:"consultantType,omitempty"`
	CompanySize    string           `json:"companySize,omitempty" bson:"companySize,omitempty"`
	GetToKnow      string           `json:"getToKnow,omitempty" bson:"getToKnow,omitempty"`
	PhoneNumber    string           `json:"phoneNumber,omitempty" bson:"phoneNumber,omitempty"`
	FirstName      string           `json:"firstName,omitempty" bson:"firstName,omitempty"`
	LastName       string           `json:"lastName,omitempty" bson:"lastName,omitempty"`
}

type UserMeta struct {
	Store UserMetaStore `json:"store" bson:"store"`
}

type User struct {
	ID             string    `json:"id" bson:"id"`
	Name           string    `json:"name" bson:"name"`
	Mail           string    `json:"mail,omitempty" bson:"mail,omitempty"`
	Password       string    `json:"-" bson:"password,omitempty"`      // Never expose in JSON
	PwdResetToken  string    `json:"-" bson:"pwdResetToken,omitempty"` // Password reset token
	Roles          []string  `json:"roles,omitempty" bson:"roles,omitempty"`
	Confirmed      bool      `json:"confirmed,omitempty" bson:"confirmed,omitempty"`
	Rejected       bool      `json:"rejected,omitempty" bson:"rejected,omitempty"`
	Comment        string    `json:"comment,omitempty" bson:"comment,omitempty"`
	LimitNodes     int       `json:"limitNodes,omitempty" bson:"limitNodes,omitempty"`
	LimitWorkflows int       `json:"limitWorkflows,omitempty" bson:"limitWorkflows,omitempty"`
	Meta           UserMeta  `json:"meta,omitempty" bson:"meta,omitempty"`
	CreatedAt      time.Time `json:"createdAt,omitempty" bson:"createdAt,omitempty"`
	UpdatedAt      time.Time `json:"updatedAt,omitempty" bson:"updatedAt,omitempty"`
}
