package zoom

type noopService struct{}

func NewNoopService() Service {
	return &noopService{}
}

func (s *noopService) Auth(code string, redirectUri string) (*AuthResponse, error) {
	return &AuthResponse{
		AccessToken:  "mock_zoom_access_token",
		TokenType:    "bearer",
		RefreshToken: "mock_zoom_refresh_token",
		ExpiresIn:    3600,
		Scope:        "meeting:read recording:read",
	}, nil
}

func (s *noopService) GetRecordings(meetingId string, accessToken string) (*RecordingsResponse, error) {
	return &RecordingsResponse{
		TotalRecords: 1,
		Recordings: []Recording{
			{
				ID:             "mock-recording-id",
				MeetingID:      meetingId,
				RecordingType:  "shared_screen_with_speaker_view",
				FileType:       "MP4",
				FileSize:       1024000,
				DownloadURL:    "https://example.com/mock-zoom-recording.mp4",
				PlayURL:        "https://example.com/mock-zoom-play",
				RecordingStart: "2024-01-01T10:00:00Z",
				RecordingEnd:   "2024-01-01T11:00:00Z",
			},
		},
	}, nil
}
