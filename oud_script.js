const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const image = new Image();
image.src = 'img.png';

image.onload = function () {
    canvas.width = image.width;
    canvas.height = image.height;

    ctx.drawImage(image, 0, 0);
    var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // iterate over each pixel
    for (var i = 0; i < imgData.length; i += 4) {
        var x = i / 4 % canvas.width;
        var y = Math.floor(i / 4 / canvas.width);
        var r = imgData[i];
        var g = imgData[i + 1];
        var b = imgData[i + 2];
        var a = imgData[i + 3];
        // draw the pixel
        const pi = Math.PI;
        const rotationX = 90;
        const rotationY = 1;
        const rotationZ = 0;
        phericalPos = mapToSphere(x, y, canvas.width, canvas.height, canvas.height / 2, rotationX, rotationY, rotationZ);

        // drawSinglePixel(x, y, r, g, b, a);
        if (phericalPos.z < 0) {
            continue;
        }

        drawSinglePixel(phericalPos.x + canvas.width / 2, phericalPos.y + canvas.height / 2, r, g, b, a);
    }
};

function mapToSphere(x, y, imageWidth, imageHeight, radius, rotationX = 0, rotationY = 0, rotationZ = 0) {
    const longitude = (x / imageWidth) * 360 - 180;
    const latitude = 90 - (y / imageHeight) * 180;

    const latRad = latitude * (Math.PI / 180);
    const lonRad = longitude * (Math.PI / 180);

    let x3D = radius * Math.cos(latRad) * Math.cos(lonRad);
    let y3D = radius * Math.sin(latRad);
    let z3D = radius * Math.cos(latRad) * Math.sin(lonRad);

    const rotXRad = rotationX * (Math.PI / 180);
    const rotYRad = rotationY * (Math.PI / 180);
    const rotZRad = rotationZ * (Math.PI / 180);

    let yRotX = y3D * Math.cos(rotXRad) - z3D * Math.sin(rotXRad);
    let zRotX = y3D * Math.sin(rotXRad) + z3D * Math.cos(rotXRad);
    y3D = yRotX;
    z3D = zRotX;

    let xRotY = x3D * Math.cos(rotYRad) + z3D * Math.sin(rotYRad);
    let zRotY = -x3D * Math.sin(rotYRad) + z3D * Math.cos(rotYRad);
    x3D = xRotY;
    z3D = zRotY;

    let xRotZ = x3D * Math.cos(rotZRad) - y3D * Math.sin(rotZRad);
    let yRotZ = x3D * Math.sin(rotZRad) + y3D * Math.cos(rotZRad);
    x3D = xRotZ;
    y3D = yRotZ;

    return { x: x3D, y: y3D, z: z3D };
}



function drawSinglePixel(x, y, r, g, b, a) {
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
    ctx.fillRect(x, y, 1, 1);
}