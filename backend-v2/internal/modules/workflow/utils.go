package workflow

func ConvertShare(share string) ShareFilters {
	switch share {
	case string(Public), string(Hidden), string(Private), string(All):
		return ShareFilters(share)
	default:
		return All
	}
}
