const request = require('supertest');
const nock = require('nock');
const { sampleHtmlWithYale } = require('./test-utils');
const fs = require('fs');
const path = require('path');

// Import the actual app (it won't start the server when imported)
const app = require('../app');

describe('API Endpoints', () => {
  beforeAll(() => {
    // Don't disable net connect - supertest needs localhost
  });

  afterAll(() => {
    // Clean up nock
    nock.cleanAll();
    nock.enableNetConnect();
  });

  afterEach(() => {
    // Clear any lingering nock interceptors after each test
    nock.cleanAll();
  });

  test('GET / should serve the index.html file', async () => {
    const response = await request(app)
      .get('/');

    expect(response.statusCode).toBe(200);
    expect(response.text).toContain('<!DOCTYPE html>');
    // Verify it's actually serving the index.html file
    const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
    expect(response.text).toBe(indexHtml);
  });

  test('POST /fetch should return 400 if URL is missing', async () => {
    const response = await request(app)
      .post('/fetch')
      .send({});

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('URL is required');
  });

  test('POST /fetch should fetch and replace Yale with Fale', async () => {
    // Mock the external URL
    nock('https://example.com')
      .get('/')
      .reply(200, sampleHtmlWithYale);

    const response = await request(app)
      .post('/fetch')
      .send({ url: 'https://example.com/' });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.title).toBe('Fale University Test Page');
    expect(response.body.content).toContain('Welcome to Fale University');
    expect(response.body.content).toContain('https://www.yale.edu/about');  // URL should be unchanged
    expect(response.body.content).toContain('>About Fale<');  // Link text should be changed
  });

  test('POST /fetch should handle errors from external sites', async () => {
    // Mock a failing URL
    nock('https://error-site.com')
      .get('/')
      .replyWithError('Connection refused');

    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await request(app)
      .post('/fetch')
      .send({ url: 'https://error-site.com/' });

    expect(response.statusCode).toBe(500);
    expect(response.body.error).toContain('Failed to fetch content');
    
    consoleSpy.mockRestore();
  });
});
