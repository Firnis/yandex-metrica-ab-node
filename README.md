# yandex-metrica-ab-node

Библиотека для проведения AB-экспериментов в Яндекс Метрике.

### Как подключиться
https://varioqub.ru/

## Инструкция:
#### express-js
```
import { getYandexMetricaAbt } from 'yandex-metrica-ab-node';

app.get('/my-page', async function (req, res) {
    const answer = await getYandexMetricaAbt(req, res, clientId);

    ...
});
```

#### nodejs
```
import { getYandexMetricaAbt } from 'yandex-metrica-ab-node';

const requestListener = async function (req: IncomingMessage, res: ServerResponse) {
    const answer = await getYandexMetricaAbt(req, res, clientId);

    ...
}

const server = createServer(requestListener);
```

#### Формат
```
interface Answer {
    flags: Record<string, string[]>;
    i: string;
    experiments: string;
}

interface NoAnswer {
    flags: Record<string, undefined>;
    i?: string;
    experiments?: string;
}
```
В случае успешного ответа разбивалки пользователей, мы получаем ответа формата Answer
В случае ошибки - NoAnswer


##### Answer.experiments
experiments - хэш, который принимает Метрика для провязки пользователя с экспериментом
При разбиении пользователей на сервере нужно передать этот параметр в функцию инициализации Метрики на клиенте
```
ym(counterId, 'init', {
    ...
    epxeriments: asnwer.experiments
});
```

##### Answer.i
Значение, которое определяет пользователя после разбиения.
Библиотека проставляет это значение в куку _ymab_param и читает из кук запроса.
Если вторым агрументом передать null или передать Response с headersSent === true, то кука выставляться не будет.

##### Answer.flags
Флаги эксперимента
Для каждого флага задаётся массив значений.
Чаще всего это будет массив с 1 значением.
Но при пересечении N экспериментов с одним флагом, в массиеве будет N значений.


### Клиентские фичи
Словарь Key-Value с данными о посетителе.
Необходим для таргетирования экспериментов.

Пример
```
    const answer = await getYandexMetricaAbt(req, res, clientId, { lang: 'ru', sex: 'male' });
```

Пример с заданным таймаутом ожидания.
```
    const answer = await getYandexMetricaAbt(req, res, clientId, 500);
```

## Nextjs
Так как nextjs работает в своём окружении и не содержит модули nodejs, то всё описанное не работает.

pages/_app.tsx
```
import App, { AppContext } from 'next/app';
import { getYandexMetricaAbt } from 'yandex-metrica-ab-node';
import { MetricaExperimentsContext } from 'yandex-metrica-ab-react';

export default class MyApp extends App {
    static async getInitialProps({ ctx, Component }: AppContext) {
        const {req, res} = ctx;

        if (!req || !res) {
            return { pageProps: {} };
        }

        const host = req.headers['x-forwarded-host'];
        const proto = req.headers['x-forwarded-proto'];
        const url = new URL(req.url || '', `${proto}://${host}`);

        const [yandexMetricaData, pageProps] = await Promise.all([
            getYandexMetricaAbt(req, res, 'metrika.xxxx', '', url.toString()),
            Component.getInitialProps?.(ctx),
        ]);

        return {
            pageProps: {
                props: pageProps,
                yandexMetricaData,
            },
        };
    }

    render() {
        const { Component, pageProps } = this.props;
        const { props, yandexMetricaData } = pageProps;

        return (
            <MetricaExperimentsContext.Provider value={yandexMetricaData}>
                <Component { ...props } />
            </MetricaExperimentsContext.Provider>
        );
    }
}
```

Если оставить всё так, то библиотека yandex-metrica-ab-node попадёт в клиентский бандл вебпака. Она небольшая, но тащить её туда незачем.
Подробнее о проблеме и как её обойти: https://nextjs.org/docs/pages/api-reference/functions/get-initial-props#caveats
