package yandex

import "math"

/* DynamicTimeoutManager manages adaptive timeout calculation based on past operation durations */
type DynamicTimeoutManager struct {
	pastDurations []float64
}

/* NewDynamicTimeoutManager creates timeout manager with initial 600s baseline (10 entries) */
func NewDynamicTimeoutManager() *DynamicTimeoutManager {
	durations := make([]float64, 10)
	for i := range durations {
		durations[i] = 600.0
	}
	return &DynamicTimeoutManager{
		pastDurations: durations,
	}
}

/* UpdateDuration adds new operation duration to rolling window (removes oldest) */
func (m *DynamicTimeoutManager) UpdateDuration(durationSeconds float64) {
	m.pastDurations = append(m.pastDurations[1:], durationSeconds)
}

/* CalculateTimeout returns adaptive timeout based on average past duration and retry count */
func (m *DynamicTimeoutManager) CalculateTimeout(retryCount int) int {
	sum := 0.0
	for _, d := range m.pastDurations {
		sum += d
	}
	avgDuration := sum / float64(len(m.pastDurations))

	/* Dynamic timeout: avg * (1 + retryCount/2), bounded [60s, 600s] */
	dynamicTimeout := avgDuration * (1.0 + float64(retryCount)/2.0)
	result := math.Max(60.0, math.Min(600.0, dynamicTimeout))

	return int(result)
}
