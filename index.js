const canvas = new Canvas()

document.addEventListener("keydown", event => {
	if(event.key.toLowerCase() == "w") {
		canvas.w = 1
	}
	else if(event.key.toLowerCase() == "a") {
		canvas.a = 1
	}
	else if(event.key.toLowerCase() == "s") {
		canvas.s = 1
	}
	else if(event.key.toLowerCase() == "d") {
		canvas.d = 1
	}
	else if(event.key == " ") {
		canvas.space = 1
		event.preventDefault()
	}
	else if(event.key == "Shift") {
		canvas.shift = 1
	}
	else if(event.key == "Control") {
		canvas.zoomMode = true
	}
})

document.addEventListener("keyup", event => {
	if(event.key.toLowerCase() == "w") {
		canvas.w = 0
	}
	else if(event.key.toLowerCase() == "a") {
		canvas.a = 0
	}
	else if(event.key.toLowerCase() == "s") {
		canvas.s = 0
	}
	else if(event.key.toLowerCase() == "d") {
		canvas.d = 0
	}
	else if(event.key == " ") {
		canvas.space = 0
		event.preventDefault()
	}
	else if(event.key == "Shift") {
		canvas.shift = 0
	}
	else if(event.key == "Control") {
		canvas.zoomMode = false
	}
})

let isLocked = false
document.getElementById("gl-canvas").addEventListener("mousedown", event => {
	glCanvas = document.getElementById("gl-canvas")
	glCanvas.requestPointerLock = glCanvas.requestPointerLock
	glCanvas.requestPointerLock()

	isLocked = true
})

document.addEventListener("pointerlockchange", event => {
	glCanvas = document.getElementById("gl-canvas")
	if(document.pointerLockElement !== glCanvas) {
		isLocked = false
	}
})

const mouseSensitivity = 500
document.getElementById("gl-canvas").addEventListener("mousemove", event => {
	if(isLocked) {
		canvas.eyeTheta += event.movementX / mouseSensitivity * (canvas.fov / 60)
		canvas.eyePhi -= event.movementY / mouseSensitivity * (canvas.fov / 60)
	}
})

document.getElementById("gl-canvas").addEventListener("wheel", event => {
	if(isLocked) {
		const amount = event.deltaY > 0 ? 100 : -100
		if(canvas.zoomMode && !canvas.space && !canvas.shift) {
			canvas.fov = Math.min(Math.max(canvas.fov - amount / 50, 10), 80)
		}
		else {
			canvas.moveSpeed = Math.max(canvas.moveSpeed - amount, 100)
		}
		event.preventDefault()
	}
})

document.getElementById("display-normals").addEventListener("input", event => {
	canvas.drawNormals = event.currentTarget.checked
})

document.getElementById("display-quads").addEventListener("input", event => {
	canvas.drawQuads = event.currentTarget.checked
})

document.getElementById("disable-shading").addEventListener("input", event => {
	canvas.disableShading = event.currentTarget.checked
})

document.getElementById("disable-shadows").addEventListener("input", event => {
	canvas.disableShadows = event.currentTarget.checked
})

document.getElementById("disable-flashlight").addEventListener("input", event => {
	canvas.hasFlashlight = !event.currentTarget.checked
})

document.getElementById("project-shadowmap").addEventListener("input", event => {
	canvas.projectShadowmap = event.currentTarget.checked
	document.getElementById("show-cascades-label").style.display = event.currentTarget.checked ? "inline" : "none"
})

document.getElementById("show-cascades").addEventListener("input", event => {
	canvas.showCascades = event.currentTarget.checked
})

document.getElementById("shadowmap-frustum").addEventListener("input", event => {
	canvas.drawShadowmapFrustum = event.currentTarget.checked
})

document.getElementById("lock-shadowmap").addEventListener("input", event => {
	canvas.lockShadowmap = event.currentTarget.checked
})

for(let i = 0; i < 4; i++) {
	document.getElementById(`shadowmap-preview-${i}`).addEventListener("click", event => {
		canvas.shadowmapPreviewCascade = i
	})
}

document.getElementById("shadowmap-resolution-button").addEventListener("click", event => {
	const shadowWidth = parseInt(document.getElementById("shadowmap-resolution").value)
	const shadowHeight = parseInt(document.getElementById("shadowmap-resolution").value)

	for(let i = 0; i < canvas.cascades; i++) {
		canvas.createShadowmap(shadowWidth, shadowHeight, i)
	}

	document.getElementById("shadowmap-megabytes").innerHTML = `${(shadowWidth * shadowHeight * 32 / 8 / 1000000).toFixed(1)}mb texture`
})

canvas.terrain = new Terrain(canvas)
canvas.terrain.generatePerlin(300, 300, 20)
canvas.terrain.generateGeometry(40, 40, 200)

for(let i = 0; i < 150; i++) {
	canvas.terrain.plantTree()
}

const solid1 = new RevolvedSolid(canvas)
canvas.solids.push(solid1)
solid1.revolveSolid(x => Math.sin(x / 35) * 20, 32, 0, (Math.PI * 35) + 0.01, Math.PI / 5)
const xIndex = Math.floor(canvas.terrain.width / 2), yIndex = Math.floor(canvas.terrain.height / 2)
const height = canvas.terrain.terrain[xIndex][yIndex]
solid1.location = vec3(xIndex * canvas.terrain.scaleX, height * canvas.terrain.scaleHeight + solid1.height / 2, yIndex * canvas.terrain.scaleY)

const monkey = new Object(canvas, "./monkey.obj")
monkey.location = vec3(xIndex * canvas.terrain.scaleX, height * canvas.terrain.scaleHeight + 300, yIndex * canvas.terrain.scaleY)
monkey.scale = vec3(5, 5, 5)
monkey.oldDraw = monkey.draw
monkey.theta = 0
monkey.phi = 0
monkey.draw = (program, deltaTime) => {
	if(deltaTime) {
		monkey.rotation += 100 * deltaTime
		monkey.theta += 100 * deltaTime * Math.PI / 180
		monkey.phi += 100 * deltaTime * Math.PI / 180
		monkey.rotationAxis = vec3(
			Math.cos(monkey.theta) * Math.cos(monkey.phi),
			Math.sin(monkey.phi),
			Math.sin(monkey.theta) * Math.cos(monkey.phi)
		)
	}

	monkey.oldDraw(program, deltaTime)
}

canvas.eyeLocation = vec3(xIndex * canvas.terrain.scaleX, height * canvas.terrain.scaleHeight + 600, yIndex * canvas.terrain.scaleY)

canvas.shadowmapPreview = new ShadowmapPreview(canvas)
canvas.render()