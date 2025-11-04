package models

import "go.mongodb.org/mongo-driver/bson/primitive"

type TemplateShare struct {
	Public bool `json:"public" bson:"public"`
}

type WorkflowTemplate struct {
	TemplateID      primitive.ObjectID `json:"_id" bson:"_id"`
	UserID          string             `json:"userId" bson:"userId"`
	Name            string             `json:"name" bson:"name"`
	Keywords        []string           `json:"keywords" bson:"keywords"`
	Root            string             `json:"root" bson:"root"`
	Share           TemplateShare      `json:"share" bson:"share"`
	BackgroundImage string             `json:"backgroundImage" bson:"backgroundImage"`
	Nodes           map[string]Node    `json:"nodes" bson:"nodes"`
	Edges           map[string]Edge    `json:"edges" bson:"edges"`
}

func (t WorkflowTemplate) IsPublic() bool {
	return t.Share.Public
}
