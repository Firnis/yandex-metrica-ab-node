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
