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
uniform sampler2D uTextureStars;
uniform float phi_offset;
uniform float theta_offset;
uniform float zoom;
uniform float aspect_ratio;
uniform float cloud_offset;
uniform float earth_rotation;
uniform float sun_phi;
uniform float sun_theta;

vec3 rotateVectorX(vec3 v, float angle) {
    mat3 rotationX = mat3(
        1.0, 0.0, 0.0,
        0.0, cos(angle), -sin(angle),
        0.0, sin(angle), cos(angle)
    );
    return rotationX * v;
}

vec3 rotateVectorY(vec3 v, float angle) {
    mat3 rotationY = mat3(
        cos(angle), 0.0, sin(angle),
        0.0, 1.0, 0.0,
        -sin(angle), 0.0, cos(angle)
    );
    return rotationY * v;
}

vec3 rotateVectorZ(vec3 v, float angle) {
    mat3 rotationZ = mat3(
        cos(angle), -sin(angle), 0.0,
        sin(angle), cos(angle), 0.0,
        0.0, 0.0, 1.0
    );
    return rotationZ * v;
}

vec3 rotateVector(float x,float y,float z, float angleX, float angleY, float angleZ) {
    vec3 v = vec3(x, y, z);
    v = rotateVectorX(v, angleX);
    v = rotateVectorY(v, angleY);
    v = rotateVectorZ(v, angleZ);
    return v;
}

vec3 rotationToVector(float angleX, float angleY, float angleZ) {
    return rotateVector(0.0, 0.0, 1.0, angleX, angleY, angleZ);
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
    float cloud_phi = mod(phi + cloud_offset, 1.0);
    float earth_phi = mod(phi + earth_rotation, 1.0);

    theta = mod(theta, 1.0);

    if (x*x + y * y < r*r) {
        vec4 dayColor = texture2D(uTextureDay, vec2(earth_phi, theta));
        vec4 nightColor = texture2D(uTextureNight, vec2(earth_phi, theta));
        vec4 cloudColor = texture2D(uTextureClouds, vec2(cloud_phi, theta));
        vec3 pos = vec3(x, y, z);
        pos = rotateVectorZ(pos, sun_theta);
        pos = rotateVectorY(pos, sun_phi);

        float alpha = mapRange(pos.x-0.05, -0.1, 0.1, 0.0, 1.0);

        float cloudAlpha = mapRange(zoom, 0.1, 0.3, 0.0, 1.0);
        gl_FragColor = mix(nightColor,dayColor, alpha) + alpha*cloudColor*cloudAlpha;
    }
    else {
        newUv = (uv - 0.5);
        r = 1.0*aspect_ratio/2.0*1.5;
        x = newUv.x * aspect_ratio;
        y = newUv.y;
        z = sqrt(r*r - x * x - y * y);
        newVec = rotateVector(x, y, z, PI * -theta_offset, PI * -phi_offset, 0.0);
        x = newVec.x;
        y = newVec.y;
        z = newVec.z;
        phi = (abs(x)/x * acos(z/sqrt(z*z + x*x)))/PI2;
        theta = acos(y/sqrt(x*x + y*y + z*z)) / PI;
        phi = mod(phi, 1.0);
        theta = mod(theta, 1.0);
        gl_FragColor = texture2D(uTextureStars, vec2(phi, theta))*0.5;
    }
    x = newUv.x * aspect_ratio;
    y = newUv.y;
    z = sqrt(r*r - x * x - y * y);
    // gl_FragColor = vec4(z, z, z, 1.0);
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

function mapRange(value, inMin, inMax, outMin, outMax) {
    return clamp((value - inMin) / (inMax - inMin) * (outMax - outMin) + outMin, outMin, outMax);
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


// set all uniforms
const phiOffsetLocation = gl.getUniformLocation(program, "phi_offset");
const thetaOffsetLocation = gl.getUniformLocation(program, "theta_offset");
const zoomLocation = gl.getUniformLocation(program, "zoom");
const resolutionLocation = gl.getUniformLocation(program, "resolution");
const aspectRatioLocation = gl.getUniformLocation(program, "aspect_ratio");
const cloudOffsetLocation = gl.getUniformLocation(program, "cloud_offset");
const earthRotationLocation = gl.getUniformLocation(program, "earth_rotation");
const sunPhiLocation = gl.getUniformLocation(program, "sun_phi");
const sunThetaLocation = gl.getUniformLocation(program, "sun_theta");

let phiOffset = 0.972;
let thetaOffset = 0.29;
let zoom = 1.0;
let aspectRatio = canvas.width / canvas.height;
let cloudOffset = 0.0;
let earthRotation = 0.0;
let sunPhi = 0.0;
let sunTheta = 0.40911;

setAllUniforms();

function setAllUniforms() {
    gl.uniform1f(phiOffsetLocation, phiOffset);
    gl.uniform1f(thetaOffsetLocation, thetaOffset);
    gl.uniform1f(zoomLocation, zoom);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(aspectRatioLocation, aspectRatio);
    gl.uniform1f(cloudOffsetLocation, cloudOffset);
    gl.uniform1f(earthRotationLocation, earthRotation);
    gl.uniform1f(sunPhiLocation, sunPhi);
    gl.uniform1f(sunThetaLocation, sunTheta);
}


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

const daymap = new Image();
const nightmap = new Image();
const clouds = new Image();
const stars = new Image();
daymap.src = "textures/daymap.jpg";
nightmap.src = "textures/nightmap.jpg";
clouds.src = "textures/clouds.jpg";
stars.src = "textures/starmap.jpg";

stars.onload = function () {
    loadTexture(stars, 0, gl.TEXTURE0, "uTextureStars");
}

daymap.onload = function () {
    loadTexture(daymap, 1, gl.TEXTURE1, "uTextureDay");
}

nightmap.onload = function () {
    loadTexture(nightmap, 2, gl.TEXTURE2, "uTextureNight");
}

clouds.onload = function () {
    loadTexture(clouds, 3, gl.TEXTURE3, "uTextureClouds");
}

function render() {
    gl.uniform1f(phiOffsetLocation, phiOffset);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function startAnimation() {
    render();
    cloudOffset -= 0.0002;
    earthRotation -= 0.0003;
    let delta = mapRange(zoom, 0.2, 0.4, -0.0006, 0);
    phiOffset += delta;

    gl.uniform1f(phiOffsetLocation, phiOffset);
    gl.uniform1f(cloudOffsetLocation, cloudOffset);
    gl.uniform1f(earthRotationLocation, earthRotation);
    requestAnimationFrame(startAnimation);
}
startAnimation();

let isDragging = false;
let startX = 0;
let startY = 0;

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

function addSlider(variable, min, max, location, name) {
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = min;
    slider.max = max;
    slider.value = variable;
    slider.step = 0.01;
    console.log(variable);
    slider.addEventListener("input", () => {
        variable = slider.value;
        gl.uniform1f(location, variable);
    });
    const label = document.createElement("label");
    label.textContent = name;
    label.htmlFor = slider.id;
    document.body.appendChild(label);
    document.body.appendChild(slider);
}

addSlider(sunPhi, -Math.PI, Math.PI, sunPhiLocation, "Sun Phi");
addSlider(sunTheta, -0.5 * Math.PI, 0.5 * Math.PI, sunThetaLocation, "Sun Theta");