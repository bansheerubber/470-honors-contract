const request = url => {
	return new Promise((resolve, reject) => {
		const request = new XMLHttpRequest()
		request.open("GET", url, true)
		request.responseType = "text"

		request.onload = (event) => {
			resolve(request.response)
		}

		request.send()
	})
}