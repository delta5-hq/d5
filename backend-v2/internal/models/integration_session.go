package models

type IntegrationSession struct {
	UserID        string `json:"userId" bson:"userId"`
	Alias         string `json:"alias" bson:"alias"`
	Protocol      string `json:"protocol" bson:"protocol"`
	LastSessionId string `json:"lastSessionId" bson:"lastSessionId"`
}
