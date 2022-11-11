import { createServer, IncomingMessage, ServerResponse } from 'http';
import { getYandexMetricaAbt } from '..';

const clientId = process.env.CLIENT_ID;

if (!clientId) {
    console.error('process.env.CLIENT_ID not set');
    process.exit(1);
}

const requestListener = async function (req: IncomingMessage, res: ServerResponse) {
    const answer = await getYandexMetricaAbt(req, res, clientId, { logged_in: 'false' });
    console.log(answer);

    res.writeHead(200);
    res.end('Hello, World!');
}

const server = createServer(requestListener);
server.listen(8080);

console.log('Listeinig on: http://localhost:8080');
