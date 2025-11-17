const request = require('supertest');
const cheerio = require('cheerio');
const { sampleHtmlWithYale } = require('./test-utils');
const nock = require('nock');

// Import the actual app (it won't start the server when imported)
const app = require('../app');

describe('Integration Tests', () => {

  beforeEach(() => {
    // Clean nock before each test to ensure fresh mocks
    nock.cleanAll();
    // Don't disable net connect - supertest needs localhost, and we'll mock external URLs
    // This is safe because supertest only makes localhost requests
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('Should replace Yale with Fale in fetched content', async () => {
    // Setup mock for example.com
    const scope = nock('https://example.com')
      .get('/')
      .reply(200, sampleHtmlWithYale);
    
    // Make a request to our proxy app using supertest
    const response = await request(app)
      .post('/fetch')
      .send({ url: 'https://example.com/' });
    
    // Verify the mock was called
    expect(scope.isDone()).toBe(true);
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    
    // Verify Yale has been replaced with Fale in text
    const $ = cheerio.load(response.body.content);
    expect($('title').text()).toBe('Fale University Test Page');
    expect($('h1').text()).toBe('Welcome to Fale University');
    expect($('p').first().text()).toContain('Fale University is a private');
    
    // Verify URLs remain unchanged
    const links = $('a');
    let hasYaleUrl = false;
    links.each((i, link) => {
      const href = $(link).attr('href');
      if (href && href.includes('yale.edu')) {
        hasYaleUrl = true;
      }
    });
    expect(hasYaleUrl).toBe(true);
    
    // Verify link text is changed
    expect($('a').first().text()).toBe('About Fale');
  });

  test('Should handle invalid URLs', async () => {
    // Suppress console.error for this test since we're intentionally testing error handling
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    const response = await request(app)
      .post('/fetch')
      .send({ url: 'not-a-valid-url' });
    
    expect(response.status).toBe(500);
    
    // Restore console.error
    consoleSpy.mockRestore();
  });

  test('Should handle missing URL parameter', async () => {
    const response = await request(app)
      .post('/fetch')
      .send({});
    
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('URL is required');
  });
});
