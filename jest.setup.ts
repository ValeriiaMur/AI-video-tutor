import '@testing-library/jest-dom';

// Mock Web Audio API
Object.defineProperty(global, 'AudioContext', {
  writable: true,
  value: jest.fn().mockImplementation(() => ({
    createAnalyser: jest.fn(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      fftSize: 2048,
      frequencyBinCount: 1024,
      getByteFrequencyData: jest.fn(),
      getByteTimeDomainData: jest.fn(),
    })),
    createMediaStreamSource: jest.fn(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
    })),
    createGain: jest.fn(() => ({
      connect: jest.fn(),
      gain: { value: 1 },
    })),
    destination: {},
    sampleRate: 44100,
    close: jest.fn(),
    resume: jest.fn(),
  })),
});

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  send = jest.fn();
  close = jest.fn();
}
Object.defineProperty(global, 'WebSocket', { writable: true, value: MockWebSocket });

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [{ stop: jest.fn(), kind: 'audio' }],
      getAudioTracks: () => [{ stop: jest.fn() }],
    }),
  },
});

// Suppress Three.js warnings in tests
jest.mock('three', () => {
  const actual = jest.requireActual('three');
  return { ...actual };
});
