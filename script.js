const canvas = document.getElementById("canvas");
const gl = canvas.getContext("webgl");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const vertexShaderSource = `
attribute vec2 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
void main() {
gl_Position = vec4(aPosition, 0.0, 1.0);
vTexCoord = aTexCoord;
}
`;
const fragmentShaderSource = `
precision mediump float;
varying vec2 vTexCoord;
uniform sampler2D uTextureDay;
uniform sampler2D uTextureNight;
uniform sampler2D uTextureClouds;
uniform float phi_offset;
uniform float theta_offset;
uniform float zoom;
uniform float aspect_ratio;

vec3 rotateVector(float x,float y,float z, float angleX, float angleY, float angleZ) {
    vec3 v = vec3(x, y, z);
    mat3 rotationX = mat3(
        1.0, 0.0, 0.0,
        0.0, cos(angleX), -sin(angleX),
        0.0, sin(angleX), cos(angleX)
    );
    mat3 rotationY = mat3(
        cos(angleY), 0.0, sin(angleY),
        0.0, 1.0, 0.0,
        -sin(angleY), 0.0, cos(angleY)
    );
    mat3 rotationZ = mat3(
        cos(angleZ), -sin(angleZ), 0.0,
        sin(angleZ), cos(angleZ), 0.0,
        0.0, 0.0, 1.0
    );
    return rotationZ * rotationY * rotationX * v;
}

float mapRange(float value, float inMin, float inMax, float outMin, float outMax) {
    return clamp((value - inMin) / (inMax - inMin) * (outMax - outMin) + outMin, outMin, outMax);
}

void main() {
    float PI = 3.1415;

    float PI2 = PI * 2.0;

    vec2 uv = vTexCoord;

    vec2 newUv = (uv - 0.5)*zoom;
    float r = 0.5;
    float x = newUv.x * aspect_ratio;
    float y = newUv.y;
    float z = sqrt(r*r - x * x - y * y);

    vec3 newVec = rotateVector(x, y, z, PI * theta_offset, PI * phi_offset, 0.0);

    x = newVec.x;
    y = newVec.y;
    z = newVec.z;

    float phi = (abs(x)/x * acos(z/sqrt(z*z + x*x)))/PI2;
    float theta = acos(y/sqrt(x*x + y*y + z*z)) / PI;

    phi = mod(phi, 1.0);
    theta = mod(theta, 1.0);

    vec4 dayColor = vec4(0.0, 0.0, 0.0, 0.0);
    vec4 nightColor = vec4(0.0, 0.0, 0.0, 0.0);
    vec4 cloudColor = vec4(0.0, 0.0, 0.0, 0.0);

    if (x*x + y * y < r*r) {
    dayColor = texture2D(uTextureDay, vec2(phi, theta));
    nightColor = texture2D(uTextureNight, vec2(phi, theta));
    cloudColor = texture2D(uTextureClouds, vec2(phi, theta));
    }

    vec3 sunDir = rotateVector(x, y, z, -1.0, -.1, 0.0);
    float alpha = mapRange(sunDir.x, -0.1, 0.1, 0.1, 1.0);
    float cloudAlpha = mapRange(zoom, 0.1, 0.3, 0.0, 1.0);
    gl_FragColor = mix(nightColor,dayColor, alpha) + alpha*cloudColor*cloudAlpha;
}
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("An error occurred compiling the shaders:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function loadTexture(image, index, texture, name) {
    gl.activeTexture(texture);
    const textureToCreate = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, textureToCreate);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.uniform1i(gl.getUniformLocation(program, name), index);
}

// Create and link the shaders
const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
gl.useProgram(program);

const phiOffsetLocation = gl.getUniformLocation(program, "phi_offset");
const thetaOffsetLocation = gl.getUniformLocation(program, "theta_offset");
const zoomLocation = gl.getUniformLocation(program, "zoom");
const resolutionLocation = gl.getUniformLocation(program, "resolution");
const aspectRatioLocation = gl.getUniformLocation(program, "aspect_ratio");

let phiOffset = 0.972;
let thetaOffset = 0.29;
let zoom = 1.0;
let aspectRatio = canvas.width / canvas.height;


gl.uniform1f(thetaOffsetLocation, thetaOffset);
gl.uniform1f(zoomLocation, zoom);
gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
gl.uniform1f(aspectRatioLocation, aspectRatio);

// Define vertices and texture coordinates
const vertices = new Float32Array([
    -1, -1, 0, 0,
    1, -1, 1, 0,
    -1, 1, 0, 1,
    1, 1, 1, 1,
]);

// Create and bind the buffer
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

// Get attribute locations, enable them, and set pointers
const aPosition = gl.getAttribLocation(program, "aPosition");
const aTexCoord = gl.getAttribLocation(program, "aTexCoord");

gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 4 * 4, 0);
gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 4 * 4, 2 * 4);
gl.enableVertexAttribArray(aTexCoord);
gl.viewport(0, 0, canvas.width, canvas.height);

// Load the images
const daymap = new Image();
const nightmap = new Image();
const clouds = new Image();
daymap.src = "textures/daymap.jpg";
nightmap.src = "textures/nightmap.jpg";
clouds.src = "textures/clouds.jpg";

daymap.onload = function () {
    loadTexture(daymap, 0, gl.TEXTURE0, "uTextureDay");
}

nightmap.onload = function () {
    loadTexture(nightmap, 1, gl.TEXTURE1, "uTextureNight");
}

clouds.onload = function () {
    loadTexture(clouds, 2, gl.TEXTURE2, "uTextureClouds");
}

// Function to render every frame
function render() {
    gl.uniform1f(phiOffsetLocation, phiOffset);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function startAnimation() {
    render();
    requestAnimationFrame(startAnimation);
}
startAnimation();


// some starting values for interactions
let isDragging = false;
let startX = 0;
let startY = 0;

// handle inputs
canvas.addEventListener("mousedown", (event) => {
    isDragging = true;
    startX = event.clientX;
    startY = event.clientY;
});

canvas.addEventListener("mousemove", (event) => {
    if (isDragging) {
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        phiOffset += deltaX / 1000 * zoom;
        thetaOffset += deltaY / 1000 * zoom;
        gl.uniform1f(thetaOffsetLocation, thetaOffset);
        startX = event.clientX;
        startY = event.clientY;
    }
});

canvas.addEventListener("mouseup", () => {
    isDragging = false;
});

canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoom = clamp(zoom * (1 + event.deltaY / 1000), 0.1, 10);
    gl.uniform1f(zoomLocation, zoom);
});

window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    aspectRatio = canvas.width / canvas.height;
    gl.uniform1f(aspectRatioLocation, aspectRatio);
});