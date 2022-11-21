import { IncomingMessage, ServerResponse as Response } from 'http';
import { get } from 'https';
import tls from 'tls';

enum FlagType {
    Flag = 'flag',
    Visual = 'visual',
    Redirect = 'redir',
}

interface UaasKV {
    n: string;
    v: string;
    t: FlagType;
}

interface UaasAnswer {
    flags: Array<UaasKV>;
    i: string;
    experiments: string;
}

interface Answer {
    flags: Record<string, string[] | undefined>;
    i?: string;
    experiments?: string;
    ready: true;
}

interface CacheItem {
    time: number;
    data: Answer;
}

interface Request extends IncomingMessage {
    originalUrl?: string;
    cookies?: Record<string, string>;
}

const cookieName = '_ymab_param';
const MAX_ATTEMPTS = 10;
const timeout = 200;
const cache_ttl = 200;
const DAY = 1000 * 60 * 60 * 24;
const YEAR = DAY * 365;

const cache: Record<string, CacheItem> = {};

function clearCache() {
    for (const [k, v] of Object.entries(cache)) {
        if (v.time < Date.now()) {
            delete cache[k];
        }
    }
}

// Чистим кэш раз в сутки
setInterval(clearCache, DAY);

function transform(answer: UaasAnswer): Answer {
    return {
        i: answer.i,
        experiments: answer.experiments,
        flags: answer.flags.reduce<Record<string, string[]>>((acc, { n, v, t }) => {
            if (t === FlagType.Visual) {
                return acc;
            }

            const storage = acc[n];

            if (storage) {
                storage.push(v);
            } else {
                acc[n] = [v];
            }

            return acc;
        }, {}),
        ready: true,
    }
}

function loadData(url: string): Promise<Answer> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(reject, timeout);
        let attempts = MAX_ATTEMPTS;

        function success(answer: UaasAnswer) {
            const data = transform(answer);

            clearTimeout(timer);

            resolve(data);
        }

        function error(err: any) {
            if (--attempts > 0) {
                sendRequest(url).then(success, error);

                return;
            }

            clearTimeout(timer);

            reject(err);
        }

        sendRequest(url).then(success, error);
    });
}

function sendRequest(url: string): Promise<UaasAnswer> {
    return new Promise((resolve, reject) => {
        get(url, (res) => {
            let data = '';

            res.on('data', chunk => data += chunk);

            res.on('close', function () {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                }
            });

            res.on('error', reject);
        }).on('error', reject);
    })
}

function getCookie(cookieString?: string, searchName = cookieName): string | undefined {
    if (!cookieString) return undefined;

    const cookies = cookieString.split(`;`);
    for (const cookie of cookies) {
        const index = cookie.indexOf('=');
        const name = cookie.slice(0, index);
        const value = cookie.slice(index + 1);

        if (searchName === name?.trim()) {
            return value?.trim();
        }
    }
}

export function getYandexMetricaAbtData(clientId: string, pageUrl: string, iCookie?: string, clientFeatures?: Record<string, string>): Promise<Answer> {
    const builder = new URL('/v1/exps/', 'https://uaas.yandex.ru');
    const params = builder.searchParams;

    params.set('client_id', String(clientId));

    if (iCookie) {
        iCookie = decodeURIComponent(iCookie);

        params.set('i', iCookie);
    }
    if (pageUrl) {
        params.set('url', pageUrl);
    }
    if (clientFeatures) {
        params.set('client_features', JSON.stringify(clientFeatures));
    }

    const url = builder.toString();

    if (iCookie) {
        const cached = cache[url];

        if (cached && cached.time > Date.now()) {
            return Promise.resolve(cached.data);
        }
    }

    return loadData(url)
        .then(answer => {
            if (answer.i) {
                cache[url] = {
                    data: answer,
                    time: Date.now() + cache_ttl,
                };
            }

            return answer;
        })
        .catch((e) => {
            if (e instanceof Error) {
                console.error(e);
            }

            return {
                flags: {},
                i: iCookie,
                experiments: undefined,
                ready: true,
            };
        });
}

function getYandexMetricaAbt(req: Request, res: Response | null, clientId: string, iCookie: string, pageUrl: string, clientFeatures?: Record<string, string>): Promise<Answer>;
function getYandexMetricaAbt(req: Request, res: Response | null, clientId: string, iCookie: string, clientFeatures?: Record<string, string>): Promise<Answer>;
function getYandexMetricaAbt(req: Request, res: Response | null, clientId: string, clientFeatures?: Record<string, string>): Promise<Answer>;

async function getYandexMetricaAbt(req: Request, res: Response | null, clientId: string, iCookie?: string | Record<string, string>, pageUrl?: string | Record<string, string>, clientFeatures?: Record<string, string>): Promise<Answer> {
    if (typeof iCookie === 'object') {
        clientFeatures = iCookie;
        iCookie = undefined;
    }
    if (typeof pageUrl === 'object') {
        clientFeatures = pageUrl;
        pageUrl = undefined;
    }

    if (!iCookie) {
        iCookie = req.cookies?.[cookieName] || getCookie(req.headers.cookie);
    }

    const isHTTPS = req.socket instanceof tls.TLSSocket;
    const protocol = isHTTPS ? 'https' : 'http';
    const url = new URL(req.originalUrl || req.url || '', `${protocol}://${req.headers.host}`);

    const answer = await getYandexMetricaAbtData(clientId, pageUrl || url.toString(), iCookie, clientFeatures);

    if (answer.i && res && !res.headersSent) {
        const expires = new Date(Date.now() + YEAR).toUTCString();
        res.setHeader('Set-Cookie', `${cookieName}=${encodeURIComponent(answer.i)}; expires=${expires};`);
    }

    return answer;
}

export { getYandexMetricaAbt };
