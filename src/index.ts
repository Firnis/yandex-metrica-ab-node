import { IncomingMessage as Request, ServerResponse as Response } from 'http';
import { get } from 'https';

type ClientId = string | number;

interface UaasKV {
    n: string;
    v: string;
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

const cookieName = '_ymab_param';
const MAX_ATTEMPTS = 10;
const timeout = 200;
const cache_ttl = 200;
const base = 'https://uaas.yandex.ru/v1/exps/?client_id=:client_id&i=:iCookie&url=:pageUrl';
const YEAR = 1000 * 60 * 60 * 24 * 365;

const cache: Record<string, CacheItem> = {};

function transform(answer: UaasAnswer): Answer {
    return {
        i: answer.i,
        experiments: answer.experiments,
        flags: answer.flags.reduce<Record<string, string[]>>((acc, { n, v }) => {
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

function loadData(id: ClientId, iParam: string | undefined, pageUrl?: string): Promise<Answer> {
    return new Promise((resolve, reject) => {
        let attempts = MAX_ATTEMPTS;

        const url = base
            .replace(':client_id', String(id))
            .replace(':pageUrl', encodeURIComponent(pageUrl || ''))
            .replace(':iCookie', iParam || '');

        const timer = setTimeout(reject, timeout);

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

export function getYandexMetricaAbt(req: Request, res: Response, clientId: string, param?: string, pageUrl?: string): Promise<Answer> {
    return new Promise(resolve => {
        if (!param) {
            param = getCookie(req.headers.cookie);
        } else if (decodeURIComponent(param) === param) {
            param = encodeURIComponent(param);
        }

        if (param) {
            const cached = cache[`${clientId}_${param}`];

            if (cached && (Date.now() - cached.time) < cache_ttl) {
                return resolve(cached.data);
            }
        }

        const reqUrl = `https://${req.headers.host}${req.url}`;

        loadData(clientId, param, pageUrl || reqUrl)
            .then(answer => {
                if (answer.i) {
                    const now = Date.now();
                    cache[`${clientId}_${answer.i}`] = {
                        data: answer,
                        time: now,
                    };

                    const expires = new Date(now + YEAR).toUTCString();
                    res.setHeader('Set-Cookie', `${cookieName}=${encodeURIComponent(answer.i)}; expires=${expires};`);
                }

                resolve(answer);
            })
            .catch((e) => {
                if (e instanceof Error) {
                    console.error(e);
                }

                resolve({
                    flags: {},
                    i: param,
                    experiments: undefined,
                    ready: true,
                });
            });
    });
}
