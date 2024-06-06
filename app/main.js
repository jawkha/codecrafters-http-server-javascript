const net = require('net')

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log('Logs from your program will appear here!')

function createResponse({ verb, resource, protocol }) {
	if (resource === '/') {
		return `HTTP/1.1 200 OK\r\n\r\n`
	} else if (resource.startsWith('/echo')) {
		const str = resource.split('/')[2]
		const headers = `Content-Type: text/plain\r\n Content-Length: ${str.length}\r\n`
		return `HTTP/1.1 200 OK\r\n${headers}\r\n${str}`
	} else {
		return `HTTP/1.1 404 Not Found\r\n\r\n`
	}
}

function sendResponse(socket, response) {
	socket.write(response)
	socket.end()
}

// Uncomment this to pass the first stage
const server = net.createServer({ keepAlive: true }, (socket) => {
	socket.on('data', (data) => {
		const request = data.toString()
		console.log({ request })
		const [header, ...body] = request.split('\r\n')
		const [verb, resource, protocol] = header.split(' ')
		const response = createResponse({ verb, resource, protocol })
		sendResponse(socket, response)
	})

	socket.on('end', () => {
		console.log('Connection closed')
	})

	socket.on('error', (err) => {
		console.error(err)
	})
})

server.listen(4221, 'localhost')
