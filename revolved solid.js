// Jacob Watson

class RevolvedSolid {
	constructor(canvas) {
		this.canvas = canvas
		this.vertexBuffer = canvas.gl.createBuffer()
		this.normalBuffer = canvas.gl.createBuffer()
		this.colorBuffer = canvas.gl.createBuffer()
		this.vertexCount = 0
		this.height = 0
		this.lineBuffer = canvas.gl.createBuffer()
		this.lineCount = 0
		this.isRendered = true
		this.location = vec3(0, 0, 0)

		this.isEmissive = false
	}

	draw(program) {
		if(!this.isRendered) {
			return
		}
		
		const gl = this.canvas.gl

		// bind vertex data
		this.canvas.boundAttribute["vPosition"] = this.vertexBuffer
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
		gl.vertexAttribPointer(this.canvas.attribute["vPosition"], 3, gl.FLOAT, false, 0, 0)

		// bind normal data
		this.canvas.boundAttribute["vNormal"] = this.normalBuffer
		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer)
		gl.vertexAttribPointer(this.canvas.attribute["vNormal"], 3, gl.FLOAT, false, 0, 0)

		// bind color data
		this.canvas.boundAttribute["vColor"] = this.normalBuffer
		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer)
		gl.vertexAttribPointer(this.canvas.attribute["vColor"], 3, gl.FLOAT, false, 0, 0)

		const modelMatrix = translate(add(this.location, vec3(0, -this.height / 2, 0)))
		
		// say its not a line
		gl.uniform1i(this.canvas.getUniformLocation(program, "isLine"), 0)

		// apply the model-view matrix
		gl.uniformMatrix4fv(
			this.canvas.getUniformLocation(program, "modelMatrix"),
			false,
			flatten(modelMatrix)
		)

		// draw the triangles
		if(this.canvas.drawQuads) {
			gl.drawArrays(gl.LINES, 0, this.vertexCount)
		}
		else {
			gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount)
		}

		if(this.canvas.drawNormals) {
			// bind line data
			gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer)
			gl.vertexAttribPointer(this.canvas.attribute["vPosition"], 3, gl.FLOAT, false, 0, 0)

			// apply line uniform
			gl.uniform1i(this.canvas.getUniformLocation(program, "isLine"), 1)

			// draw the lines
			gl.drawArrays(gl.LINES, 0, this.lineCount)
		}
	}

	revolveSolid(equation, quality, min, max, step) {
		const gl = this.canvas.gl
		const triangles = []
		const normals = []
		const colors = []
		const lines = []
		const createTriangle = (point1, point2, point3) => {
			triangles.push(point1)
			triangles.push(point2)
			triangles.push(point3)

			const color = vec4(
				Math.random(),
				Math.random(),
				Math.random(),
				1
			)
			colors.push(color)
			colors.push(color)
			colors.push(color)
		}

		const equals = (point1, point2) => {
			if(
				Math.abs(point1[0] - point2[0]) <= Number.EPSILON * 10
				&& Math.abs(point1[1] - point2[1]) <= Number.EPSILON * 10
				&& Math.abs(point1[2] - point2[2]) <= Number.EPSILON * 10
			) {
				return true
			}

			return false
		}
		
		const results = []
		for(let i = 0; i < quality; i++) {
			const theta = i / quality * Math.PI * 2
			results[i] = []

			for(let j = min; j < max; j += step) {
				const result = equation(j)
				const vector = vec3(
					Math.cos(theta) * result, // x
					j, // height
					Math.sin(theta) * result, // y
				)

				for(let i = 0; i < 3; i++) {
					if(isNaN(vector[i])) {
						vector[i] = 0
					}
				}

				vector.normal = vec3(0, 0, 0)
				results[i].push(vector)
			}
		}

		// triangulate result
		for(let i = 1; i <= quality; i++) {
			const firstArray = results[i - 1]
			const secondArray = results[i % quality]

			for(let j = 1; j < firstArray.length; j++) {
				const a1 = firstArray[j - 1]
				const b1 = firstArray[j]
				const a2 = secondArray[j - 1]
				const b2 = secondArray[j]

				if(!equals(a1, b1) && !equals(a1, a2) && !equals(b1, a2)) {
					createTriangle(a1, b1, a2)
				}

				if(!equals(a2, b1) && !equals(a2, b2) && !equals(b1, b2)) {
					createTriangle(a2, b1, b2)
				}
			}
		}

		// calculate normals
		for(let i = 0; i < triangles.length; i += 3) {
			const point1 = triangles[i]
			const point2 = triangles[i + 1]
			const point3 = triangles[i + 2]
			
			const normal = normalize(cross(subtract(point2, point1), subtract(point3, point1)))

			for(let j = 0; j < 3; j++) {
				if(isNaN(normal[j])) {
					if(j == 0) {
						console.log(`${point1[0]} ${point1[1]} ${point1[2]}`, `${point2[0]} ${point2[1]} ${point2[2]}`, `${point3[0]} ${point3[1]} ${point3[2]}`, i)
					}
					
					normal[j] = 0
				}
			}

			point1.normal = add(point1.normal, normal)
			point2.normal = add(point2.normal, normal)
			point3.normal = add(point3.normal, normal)
		}

		// normalize normals
		for(const point of triangles) {
			for(let i = 0; i < 3; i++) {
				if(isNaN(point.normal[i])) {
					point.normal[i] = 0
				}
			}
			
			point.normal = normalize(point.normal)
			normals.push(point.normal)

			lines.push(point)
			lines.push(add(scale(0.2, point.normal), point))
		}
		
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, flatten(triangles), gl.STATIC_DRAW)

		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW)

		gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW)

		gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, flatten(lines), gl.STATIC_DRAW)
		this.lineCount = lines.length

		this.height = Math.abs(max - min)

		this.vertexCount = triangles.length
	}
}