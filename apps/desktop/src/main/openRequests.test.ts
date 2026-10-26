import { describe, expect, it } from 'vitest';
import { createOpenRequests, epdPathsFromArgv } from './openRequests';

describe('open requests', () => {
  // protects=AC 6 a file passed at launch opens; fails_when=a request before the page is ready is lost or delivered early, one after is delayed, or the path is not allowed for Save; no_claim=the Electron events (E2E)
  it('holds requests until the page is ready, then sends at once', () => {
    const sent: string[] = [];
    const allowed: string[] = [];
    const requests = createOpenRequests({
      send: (p) => sent.push(p),
      allow: (p) => allowed.push(p),
    });
    requests.push('/a.epd');
    expect(sent).toEqual([]);
    expect(allowed).toEqual(['/a.epd']);
    requests.ready();
    expect(sent).toEqual(['/a.epd']);
    requests.push('/b.epd');
    expect(sent).toEqual(['/a.epd', '/b.epd']);
    requests.ready();
    expect(sent).toHaveLength(2);
  });

  // protects=a reload does not lose a file; fails_when=a request during a reload is sent to the page that is going away; no_claim=the reload itself
  it('holds requests again after a reset', () => {
    const sent: string[] = [];
    const requests = createOpenRequests({ send: (p) => sent.push(p), allow: () => undefined });
    requests.ready();
    requests.reset();
    requests.push('/a.epd');
    expect(sent).toEqual([]);
    requests.ready();
    expect(sent).toEqual(['/a.epd']);
  });

  // protects=AC 6 command line parsing; fails_when=flags, the app folder or other files are taken for projects, the extension is case-sensitive, or a relative path is not resolved against the launch folder; no_claim=Windows path quoting
  it('takes only .epd paths from a command line', () => {
    expect(
      epdPathsFromArgv(
        ['/app', '--lang=en', '--x.epd', 'notes.txt', '/p/House.EPD', 'rel/a.epd'],
        '/work',
      ),
    ).toEqual(['/p/House.EPD', '/work/rel/a.epd']);
  });
});
