import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const summary = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

async function fresh() {
  vi.resetModules();
  return (await import('../services/wikiImage')).lookupWikiImage;
}

describe('lookupWikiImage', () => {
  beforeEach(() => mockFetch.mockReset());

  it('returns the thumbnail and article link for a normal page', async () => {
    const lookup = await fresh();
    mockFetch.mockImplementation(() =>
      summary({
        type: 'standard',
        title: 'Happiness',
        thumbnail: { source: 'https://upload.wikimedia.org/happy.jpg' },
        content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Happiness' } },
      }),
    );
    expect(await lookup('Happy')).toEqual({
      src: 'https://upload.wikimedia.org/happy.jpg',
      pageUrl: 'https://en.wikipedia.org/wiki/Happiness',
      title: 'Happiness',
    });
    expect(mockFetch.mock.calls[0][0]).toContain('/page/summary/happy');
  });

  it('skips disambiguation pages, pages without an image, errors and failures', async () => {
    const lookup = await fresh();
    mockFetch
      .mockImplementationOnce(() => summary({ type: 'disambiguation', title: 'Run', thumbnail: { source: 'x' } }))
      .mockImplementationOnce(() => summary({ type: 'standard', title: 'Skepticism' }))
      .mockImplementationOnce(() => summary({}, 404))
      .mockImplementationOnce(() => Promise.reject(new TypeError('offline')));
    for (const w of ['run', 'skeptic', 'qwzx', 'lantern']) expect(await lookup(w)).toBeNull();
  });

  it('looks each word up only once', async () => {
    const lookup = await fresh();
    mockFetch.mockImplementation(() => summary({ type: 'standard', title: 'Lantern', thumbnail: { source: 's' } }));
    await lookup('lantern');
    await lookup('Lantern');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
