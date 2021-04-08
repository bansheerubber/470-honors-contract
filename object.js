const positionBufferMap = {}
const normalBufferMap = {}
const uvBufferMap = {}
const lineBufferMap = {}
const vertexCountMap = {}
const lineCountMap = {}

class SubObject {
	constructor(canvas, filename, name, parent) {
		this.canvas = canvas
		const gl = canvas.gl

		this.parent = parent
		this.filename = filename
		this.name = name
		
		// info as it is stored in the file
		this.faceList = []

		// info we pass directly to opengl
		this.orderedPositions = []
		this.orderedNormals = []
		this.orderedUVs = []
		this.orderedLines = []

		if(!positionBufferMap[filename]) {
			positionBufferMap[filename] = {}
			normalBufferMap[filename] = {}
			uvBufferMap[filename] = {}
			lineBufferMap[filename] = {}
			vertexCountMap[filename] = {}
			lineCountMap[filename] = {}
		}

		if(!positionBufferMap[filename][name]) {
			positionBufferMap[filename][name] = this.positionBuffer = gl.createBuffer()
			normalBufferMap[filename][name] = this.normalBuffer = gl.createBuffer()
			uvBufferMap[filename][name] = this.uvBuffer = gl.createBuffer()
			lineBufferMap[filename][name] = this.lineBuffer = gl.createBuffer()

			this.vertexCount = 0

			this.reusesBuffers = false
		}
		else {
			this.positionBuffer = positionBufferMap[filename][name]
			this.normalBuffer = normalBufferMap[filename][name]
			this.uvBuffer = uvBufferMap[filename][name]
			this.lineBuffer = lineBufferMap[filename][name]

			this.vertexCount = vertexCountMap[filename][name]
			this.lineCount = lineCountMap[filename][name]

			this.reusesBuffers = true
		}
	}

	fillGLBuffers(positionList, normalList, uvList) {
		if(this.reusesBuffers) {
			return
		}
		
		const gl = this.canvas.gl

		const createFace = (a, b, c) => {
			this.orderedPositions.push(positionList[a[0]])
			this.orderedPositions.push(positionList[b[0]])
			this.orderedPositions.push(positionList[c[0]])

			this.orderedUVs.push(uvList[a[1]])
			this.orderedUVs.push(uvList[b[1]])
			this.orderedUVs.push(uvList[c[1]])

			this.orderedNormals.push(normalList[a[2]])
			this.orderedNormals.push(normalList[b[2]])
			this.orderedNormals.push(normalList[c[2]])

			this.orderedLines.push(positionList[a[0]])
			this.orderedLines.push(add(scale(1, normalList[a[2]]), positionList[a[0]]))

			this.orderedLines.push(positionList[b[0]])
			this.orderedLines.push(add(scale(1, normalList[b[2]]), positionList[b[0]]))

			this.orderedLines.push(positionList[c[0]])
			this.orderedLines.push(add(scale(1, normalList[c[2]]), positionList[c[0]]))
		}
		
		for(const face of this.faceList) {
			if(face.length == 3) {
				const a = face[0]
				const b = face[1]
				const c = face[2]

				createFace(a, b, c)
			}
			else if(face.length == 4) {
				const a = face[0]
				const b = face[1]
				const c = face[2]
				const d = face[3]

				createFace(a, b, c)
				createFace(c, d, a)
			}
		}

		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, flatten(this.orderedPositions), gl.STATIC_DRAW)

		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, flatten(this.orderedNormals), gl.STATIC_DRAW)

		gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, flatten(this.orderedUVs), gl.STATIC_DRAW)

		gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, flatten(this.orderedLines), gl.STATIC_DRAW)

		positionBufferMap[this.filename][this.name] = this.positionBuffer
		normalBufferMap[this.filename][this.name] = this.normalBuffer
		uvBufferMap[this.filename][this.name] = this.uvBuffer
		lineBufferMap[this.filename][this.name] = this.lineBuffer
		vertexCountMap[this.filename][this.name] = this.orderedPositions.length
		lineCountMap[this.filename][this.name] = this.orderedLines.length

		this.vertexCount = this.orderedPositions.length
		this.lineCount = this.orderedLines.length
	}
	
	draw(program) {
		const gl = this.canvas.gl

		{
			// bind vertex data
			if(this.canvas.boundAttribute["vPosition"] !== this.positionBuffer) {
				this.canvas.boundAttribute["vPosition"] = this.positionBuffer
				gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
				gl.vertexAttribPointer(this.canvas.attribute["vPosition"], 3, gl.FLOAT, false, 0, 0)
			}

			// bind normal data
			if(this.canvas.boundAttribute["vNormal"] !== this.normalBuffer) {
				this.canvas.boundAttribute["vNormal"] = this.normalBuffer
				gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer)
				gl.vertexAttribPointer(this.canvas.attribute["vNormal"], 3, gl.FLOAT, false, 0, 0)
			}

			// use normals as color for now
			if(this.canvas.boundAttribute["vColor"] !== this.normalBuffer) {
				this.canvas.boundAttribute["vColor"] = this.normalBuffer
				gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer)
				gl.vertexAttribPointer(this.canvas.attribute["vColor"], 3, gl.FLOAT, false, 0, 0)
			}
			
			// say its not a line
			gl.uniform1i(this.canvas.getUniformLocation(program, "isLine"), 0)

			// apply the model-view matrix
			gl.uniformMatrix4fv(
				this.canvas.getUniformLocation(program, "modelMatrix"),
				false,
				this.parent.modelMatrixFlattened
			)

			// draw the triangles
			if(this.canvas.drawQuads) {
				gl.drawArrays(gl.LINES, 0, vertexCountMap[this.filename][this.name])
			}
			else {
				gl.drawArrays(gl.TRIANGLES, 0, vertexCountMap[this.filename][this.name])
			}
		}

		if(this.canvas.drawNormals) {
			// bind line data
			this.canvas.boundAttribute["vPosition"] = this.lineBuffer
			gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer)
			gl.vertexAttribPointer(this.canvas.attribute["vPosition"], 3, gl.FLOAT, false, 0, 0)

			// apply line uniform
			gl.uniform1i(this.canvas.getUniformLocation(program, "isLine"), 1)

			// draw the lines
			gl.drawArrays(gl.LINES, 0, lineCountMap[this.filename][this.name])
		}
	}
}

class Object {
	constructor(canvas, filename) {
		this.canvas = canvas
		this.load(filename)
		this._location = vec3(0, 0, 0)
		this._rotationAxis = vec3(1, 0, 0)
		this._rotation = 0
		this._scale = vec3(1, 1, 1)
		this.calculateModelMatrix()

		canvas.solids.push(this)
	}

	calculateModelMatrix() {
		this.modelMatrix = mult(
			mult(
				translate(this.location),
				rotate(
					this.rotation,
					this.rotationAxis
				)
			),
			scalem(this.scale, this.scale, this.scale),
		)

		this.modelMatrixFlattened = flatten(this.modelMatrix)
	}

	set location(location) {
		this._location = location
		this.calculateModelMatrix()
	}

	set rotationAxis(rotationAxis) {
		this._rotationAxis = rotationAxis
		this.calculateModelMatrix()
	}

	set rotation(rotation) {
		this._rotation = rotation
		this.calculateModelMatrix()
	}

	set scale(scale) {
		this._scale = scale
		this.calculateModelMatrix()
	}

	get location() {
		return this._location
	}

	get rotationAxis() {
		return this._rotationAxis
	}

	get rotation() {
		return this._rotation
	}

	get scale() {
		return this._scale
	}

	async load(filename) {
		this.filename = filename
		const data = await request(this.filename)
		const lines = data.split("\n")

		this.subObjects = []
		let currentObject = null
		const positionList = [], normalList = [], uvList = []
		for(const line of lines) {
			const split = line.split(" ")
			if(split[0] == "o") {
				// create the object
				const name = split[1]
				currentObject = new SubObject(canvas, filename, name, this)
				this.subObjects.push(currentObject)
			}

			// interpret commands if we have a valid object
			if(currentObject && !currentObject.reusesBuffers) {
				switch(split[0]) {
					// vertex position
					case "v": {
						positionList.push(
							vec3(
								parseFloat(split[1]),
								parseFloat(split[2]),
								parseFloat(split[3])
							)
						)
						break
					}

					// vertex normal
					case "vn": {
						normalList.push(
							vec3(
								parseFloat(split[1]),
								parseFloat(split[2]),
								parseFloat(split[3])
							)
						)
						break
					}

					// vertex uv
					case "vt": {
						uvList.push(
							vec2(
								parseFloat(split[1]),
								parseFloat(split[2])
							)
						)
						break
					}

					// face
					case "f": {
						// store faces for later, we'll process these in a separate loop
						const face = []
						for(let i = 1; i < split.length; i++) {
							const faceSplit = split[i].split("/")
							face.push(faceSplit.map(value => value - 1)) // subtract 1 from every index since arrays start from 0
						}
						currentObject.faceList.push(face)
						break
					}
				}
			}
		}

		for(const object of this.subObjects) {
			object.fillGLBuffers(positionList, normalList, uvList)
		}
	}

	draw(program) {
		if(this.subObjects) {
			for(const object of this.subObjects) {
				object.draw(program)
			}
		}
	}

	get vertexCount() {
		if(this.subObjects) {
			return this.subObjects.reduce((total, value) => total + value.vertexCount, 0)
		}
		else {
			return 0
		}
	}
}