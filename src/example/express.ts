import express from 'express';
import { getYandexMetricaAbt } from '..';

const clientId = process.env.CLIENT_ID;

if (!clientId) {
    console.error('process.env.CLIENT_ID not set');
    process.exit(1);
}

const app = express();

app.get('/', async function (req, res) {
    const answer = await getYandexMetricaAbt(req, res, clientId, { logged_in: 'false' });
    console.log(answer);

    res.send('Hello World');
});

app.listen(8080);
