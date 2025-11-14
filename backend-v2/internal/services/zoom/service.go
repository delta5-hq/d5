package zoom

type Service interface {
	Auth(code string, redirectUri string) (*AuthResponse, error)
	GetRecordings(meetingId string, accessToken string) (*RecordingsResponse, error)
}

type AuthResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
}

type RecordingsResponse struct {
	TotalRecords int         `json:"total_records"`
	Recordings   []Recording `json:"recording_files"`
}

type Recording struct {
	ID           string `json:"id"`
	MeetingID    string `json:"meeting_id"`
	RecordingType string `json:"recording_type"`
	FileType     string `json:"file_type"`
	FileSize     int64  `json:"file_size"`
	DownloadURL  string `json:"download_url"`
	PlayURL      string `json:"play_url"`
	RecordingStart string `json:"recording_start"`
	RecordingEnd   string `json:"recording_end"`
}
