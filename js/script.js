/* Setup UI */
/* Create the canvas */
let canvasDiv = document.getElementById("canvas");
let canvasWidth = canvasDiv.offsetWidth;
let canvasHeight= canvasDiv.offsetHeight;
canvasWidth = canvasWidth < 1024 ? 1024 : canvasWidth;
var draw = SVG().addTo('#canvas').size(canvasWidth, canvasHeight);
const BEAM_Y = canvasHeight/3;
const DIMENSION_Y = BEAM_Y + canvasHeight/3.3;
const NUMBER_OF_NODES = 71;
let FONT_SIZE;
let beamCanvasRatio;
/* Responsive parameter */
if(window.innerWidth < 1024) {
    beamCanvasRatio = 0.8;
    FONT_SIZE = 14;
} else if (window.innerWidth < 1366){
    beamCanvasRatio = 0.8;
    FONT_SIZE = 14;
} else {
    beamCanvasRatio = 0.6;
    FONT_SIZE = 16;
}

/* Instantiate beam object */ 
let beam = {
    supports: [],
    forces: [],
    loads: [],
    results: {
        displacements : [],
        reactions: []
    }
};

updateToolBar();

/* Uncomment this line to setup a preset beam*/
/* devSetupBeam();*/

/**
* Manage the toolbar.
*/
function updateToolBar() {
    if(!beam.length){
        disableToolBar();
        enableTool('beam-tool')
    } else {
        enableToolBar();
        disableTool('beam-tool');
    }
}

/**
* Determines if the beam is hypostatic.
*/
function isHypostatic() {
    degreesOfHyperstatism = beam.supports.map(x => x.typeIndex ? x.typeIndex : 1).reduce((a, c) => a + c, 0);
    
    if (degreesOfHyperstatism >= 2) {
        return false;
    }
    return true;
}

/**
* Disable all tools.
*/
function disableToolBar() {
    document.getElementsByClassName('tool').forEach(function(child){
        disableTool(child.id);
    })
}

/**
* Enable all tools.
*/
function enableToolBar() {
    document.getElementsByClassName('tool').forEach(function(child){
        enableTool(child.id);
    })
}

/**
* Create a new beam.
*/
function newBeam() {
    /* Get parameters in the view */
    beam.length = parseFloat(getValueOrPlaceholder('length'));
    beam.length = Math.round(beam.length*100)/100
    beam.youngModulus = parseFloat(getValueOrPlaceholder('youngModulus'));
    beam.inertia = parseFloat(getValueOrPlaceholder('inertia'));
    
    /* Pre-fill the location of the first force in the middle of the beam */
    document.getElementById('forceLocation').placeholder = beam.length/2
    /* Update the nodes locations */
    beam.locations = [0, beam.length];
    
    /* Draw the beam on canvas */
    drawBeam();
    
    /* Once the beam is created, we close the modal */
    closeModal('beam-modal');
    
    /* Update the toolbar */
    updateToolBar();
}

/**
* Draw the beam, supports, forces and dimensions.
* @param {Object} beam 
*/
function drawBeam() {
    let maxMagnitude
    let minMagnitude
    /* Clear canvas */
    draw.clear();
    
    /* Draw the beam */
    beamDraw = draw.rect(canvasWidth*beamCanvasRatio,3).attr({ fill: '#000'})
    beamDraw.cx(canvasWidth/2).cy(BEAM_Y);
    
    /* Draw the supports */
    beam.supports.forEach(function(support){
        drawSupport(support.location, support.typeIndex);
    })
    
    /* Draw the forces */
    /* Finding Extreme Magnitudes */
    if(beam.forces.length > 0) {
        maxMagnitude = math.max(beam.forces.map(x => math.abs(x.magnitude)));
        minMagnitude = math.min(beam.forces.map(x => math.abs(x.magnitude)));
        beam.forces.forEach(function(force) {
            forceHeight = normalizeForceToDraw(force, minMagnitude, maxMagnitude).magnitude;
            if(force.magnitude > 0) {
                drawForce(force, forceHeight, true);
            } else {
                drawForce(force, forceHeight);
            }   
        })
    }  
    
    
    /* Draw dimensions */
    drawDimensions()
    drawDimensionsText();
    
    if((beam.forces.length != 0 || beam.loads.length != 0) & !isHypostatic()) {
        compute();
    }
    
    if(beam.results.displacements.length > 0 && beam.results.reactions.length > 0) {
        drawDisplacements();
        drawReactions(minMagnitude, maxMagnitude);
    }
}

/**
* Return a filtered array of one value every modulo. 
* @param {Array} array 
* @param {number} modulo 
* @param {number} offset 
*/
function getModuloIndices(array, modulo, offset) {
    let arrayToReturn = array.map(function(current, i){
        if(i%modulo==offset){
            return current
        }
    }).filter(x => x != undefined)
    
    return arrayToReturn;
}

function normalizeForceToDraw(force, minMagnitude, maxMagnitude) {
    normalizedMagnitude = math.abs(force.magnitude/maxMagnitude * canvasHeight/10) + canvasHeight/50
    return { location: force.location, magnitude: normalizedMagnitude };
}

function drawReactions(minMagnitude, maxMagnitude){
    let reactionsForces = getModuloIndices(beam.results.reactions, 2, 0)
    let reactionsMoments = getModuloIndices(beam.results.reactions, 2, 1)
    
    /**Draw reactions on supports */
    let reactionsColor = '#eb3b5a'
    beam.supports.forEach(function(support, index) {
        forceHeight = normalizeForceToDraw(support.reactionForce, minMagnitude, maxMagnitude).magnitude;
        if(math.abs(support.reactionForce.magnitude) < 0.1 ) {
            return;
        } else {
            if(support.reactionForce.magnitude < 0) {
                drawForce(support.reactionForce, forceHeight, true, reactionsColor);
            } else {
                drawForce(support.reactionForce, forceHeight, false, reactionsColor);
            }
        }
        
        if(math.abs(support.reactionMoment.magnitude) > 0.1 ){
            drawMoment(support.reactionMoment, reactionsColor)
        }
        
    })
}

/**
* Draw a moment
* @param {Object} moment 
* @param {string} color 
*/
function drawMoment(moment, color){
    const canvasLocation = getXCanvasLocation(moment.location)
    const xOrigin = getXCanvasLocation(0)
    const radius = 15;
    let path = ['M', xOrigin + 5, BEAM_Y - 10, 'A', radius, radius, 0, 1, 1, xOrigin, BEAM_Y].join(' ')
    let arc = draw.path(path).fill('none').stroke({ width: 3, color: color })
    arc.cx(canvasLocation);
    
    let arrow = draw.polyline([canvasLocation - radius, BEAM_Y, canvasLocation - radius - 5, BEAM_Y + 10, canvasLocation - radius + 5, BEAM_Y + 10])
    arrow.rotate(-20)
    arrow.y(BEAM_Y - 5)
    arrow.x(canvasLocation - radius - 4)
    arrow.fill({color: color })
    
    if(moment.magnitude > 0){
        arc.transform({ flip: 'x' })
        //arrow.transform({ flip: 'x' })
        arrow.cx(canvasLocation + radius);
        arrow.cy(BEAM_Y + 6);
        arrow.rotate(10)
    }
    
    /* Handle Text positionning */
    let textToDraw = moment.magnitude.toString() + " N.m";
    
    text = draw.text(textToDraw).cx(canvasLocation).cy(BEAM_Y - canvasHeight/15*(moment.magnitude < 0 ? 1 : -1))
    text.font({ size: FONT_SIZE, anchor: 'right' });
}

/**
* Draw the results based on beam results.
*/
function drawDisplacements() {
    
    const nodesCanvasLocations = beam.results.nodesLocations.map(getXCanvasLocation);
    
    let verticalDisplacements = getModuloIndices(beam.results.displacements, 2, 0);
    
    curveCoordinates = []
    maxVerticalDisplacement = math.max(verticalDisplacements.map(x => math.abs(x)))
    normalizedVerticalDisplacements = verticalDisplacements.map(x => x / maxVerticalDisplacement * canvasHeight * 0.15)
    for (let index = 0; index < nodesCanvasLocations.length; index++) {
        curveCoordinates[index] = [nodesCanvasLocations[index], -normalizedVerticalDisplacements[index]+BEAM_Y];
    }
    
    displacementsCurve = draw.polyline(curveCoordinates)
    displacementsCurve.fill('none')
    let gradient = draw.gradient('linear', function(add){
        add.stop(0, '#2196f3');
        //add.stop(0.5, '#d76d77');
        add.stop(0.8, '#eb3b5a');   
    }).from(0,0).to(0,1)
    displacementsCurve.stroke({ color: gradient, width: 3, opacity: 0.8 })
    
    /* Find and draw extrema */
    math.diff(verticalDisplacements).forEach(function(value, index, values){
        nextValue = values[index+1]
        if(value / nextValue < 0) {
            draw.circle(canvasHeight/100).cx(nodesCanvasLocations[index + 1]).cy(BEAM_Y - normalizedVerticalDisplacements[index + 1])
            textToDraw = math.format(verticalDisplacements[index + 1], {notation: 'exponential', precision: 2});
            offset = verticalDisplacements[index + 1] < 0 ? canvasHeight/50 : -canvasHeight/50
            text = draw.text(textToDraw.toString() + ' mm').cx(nodesCanvasLocations[index + 1]).cy(BEAM_Y - normalizedVerticalDisplacements[index + 1] + offset)
            text.font({ size: FONT_SIZE, anchor: 'right' });
        }
    });
}

/**
* Draw a force
* @param {number} x 
* @param {number} magnitude 
*/
function drawForce(force, forceHeight, isUnderTheBeam, color) {
    
    forceLocation = getXCanvasLocation(force.location);
    const arrowBodyHeight = math.abs(forceHeight);
    const arrowTipHeight = canvasHeight/(15 * 5)
    let arrowColor = color ? color : '#000'
    let arrowDrawing = draw.nested();
    
    /* Draw the arrow */
    let arrowBodyX = forceLocation;
    let arrowBodyY = BEAM_Y;    
    let arrowTip;
    let arrowBody;
    
    if(force.magnitude > 0 ){
        arrowBody = arrowDrawing.rect(4, arrowBodyHeight).cx(arrowBodyX).y(arrowBodyY + arrowTipHeight);
        arrowTip = arrowDrawing.polyline([
            arrowBodyX, arrowBodyY,
            arrowBodyX + arrowTipHeight/2, arrowBodyY + arrowTipHeight,
            arrowBodyX-arrowTipHeight/2, arrowBodyY + arrowTipHeight,
        ])
    } else {
        arrowBody = arrowDrawing.rect(4, arrowBodyHeight).cx(arrowBodyX).y(arrowBodyY);
        arrowTip = arrowDrawing.polyline([
            arrowBodyX, arrowBodyY + arrowBodyHeight + arrowTipHeight,
            arrowBodyX + arrowTipHeight/2, arrowBodyY + arrowBodyHeight,
            arrowBodyX-arrowTipHeight/2, arrowBodyY + arrowBodyHeight,
        ])
    }
    
    arrowBody.fill({ color: arrowColor })
    arrowTip.fill({ color: color });
    
    if(!isUnderTheBeam){
        arrowDrawing.y(-arrowBodyHeight - arrowTipHeight)
    }
    
    /* Handle Text positionning */
    let textToDraw = math.abs(force.magnitude.toString()) + " N";
    
    text = draw.text(textToDraw).cx(forceLocation).cy(arrowBodyY - (arrowBodyHeight + arrowTipHeight) - canvasHeight/50)
    text.font({ size: FONT_SIZE, anchor: 'right' });
    
    if(isUnderTheBeam) {
        text.cy(arrowBodyY + (arrowBodyHeight + arrowTipHeight) + canvasHeight/50)
    }
}


/**
* Disable all tools but the one specified. Used at start and when a tool modal is open.
* @param {string} toolId 
*/
function disableAllToolsBut(toolId){
    disableToolBar();
    enableTool(toolId);
}

/**
* Open a modal.
* @param {string} modalId 
*/
function openModal(modalId) {
    document.getElementById(modalId).style.display = "block";
}

/**
* Close a modal.
* @param {string} modalId 
*/
function closeModal(modalId) {
    document.getElementById(modalId).style.display = "none";
    if(modalId != 'beam-modal') {
        enableToolBar();
        disableTool('beam-tool');
    }
}

/**
* Disable a tool in the toolbar
* @param {string} toolId 
*/
function disableTool(toolId) {
    tool = document.getElementById(toolId)
    tool.style.pointerEvents = 'none';
    tool.style.opacity = 0.3; 
}

/**
* Enable a tool in the toolbar
* @param {string} toolId 
*/
function enableTool(toolId) {
    tool = document.getElementById(toolId)
    tool.style.pointerEvents = 'auto';
    tool.style.opacity = 1;
}

/**
* Draw all dimensions
*/
function drawDimensions() {
    /* Draw the main dimension line */
    const dimensionOvershoot = canvasWidth*0.01;
    draw.rect(canvasWidth * beamCanvasRatio + dimensionOvershoot,1).attr({ fill: '#888'}).cx(canvasWidth/2).cy(DIMENSION_Y);
    
    /* Draw the beam extension lines */
    const startOfTheBeamX = getXCanvasLocation(0)
    drawExtensionLine(startOfTheBeamX);
    const endOfTheBeamX = getXCanvasLocation(beam.length);
    drawExtensionLine(endOfTheBeamX);
    
    /* Draw supports extension lines */
    beam.supports.forEach(function(support) {
        drawExtensionLine(getXCanvasLocation(support.location));
    })
    
    /* Draw forces extension lines */
    beam.forces.forEach(function(force) {
        drawExtensionLine(getXCanvasLocation(force.location));
    })
}

/**
* Draw an extension line at a specified x coordinate
* @param {number} x 
*/
function drawExtensionLine(x) {
    const extensionLineLength = canvasHeight * 0.1;
    const extensionOvershoot = (canvasWidth * 0.01)/2;
    const dimensionY = DIMENSION_Y;
    draw.rect(1, extensionLineLength).attr({ fill: '#888'}).move(x, dimensionY - extensionLineLength + extensionOvershoot);
    draw.rect(extensionOvershoot * Math.sqrt(2) * 2,1).attr({ fill: '#888'}).cx(x).cy(dimensionY).rotate(-45);
}

/**
* Create a new support
*/
function newSupport() {
    /* Get parameters from the view */
    supportLocation = parseFloat(getValueOrPlaceholder('supportLocation'));
    /* Round to cm */
    supportLocation = Math.round(supportLocation*100)/100
    supportTypeIndex = document.getElementById('supportType').selectedIndex;
    fixedSupportLocation = document.getElementById('startEndLocation').selectedIndex;
    
    if(supportLocation < 0 || supportLocation > beam.length) {
        alert("Vérifiez la position de l' appui");
        closeModal('support-modal');
        return;
    }
    
    /* If support if Fixed then location can be either 0 or beam length (left or right of the beam) */
    if(supportTypeIndex == 2) {
        supportLocation = fixedSupportLocation == 0 ? 0 : beam.length;
    }
    
    /* Create the new support object */
    let newSupport = { location : supportLocation, typeIndex : supportTypeIndex }
    
    /* If a support already exists at this location, warn the user */
    if(beam.supports.find(x => x.location == supportLocation)){
        if (confirm('Une appui existe déjà à cette position, voulez vous le remplacer ?')) {
            beam.supports.forEach(function(support, index){
                if(support.location == newSupport.location){
                    beam.supports[index].typeIndex = newSupport.typeIndex; 
                }
            })  
        }
        
        drawBeam();
        closeModal('support-modal');
        return;
    }
    
    /* Else, add the support to the beam object */
    beam.supports.push(newSupport);
    
    /* Add a new node location if it does not exist already */
    if(beam.locations.indexOf(supportLocation) == -1){
        beam.locations.push(supportLocation);
    }
    
    /* Sort locations array in ascending order (from left to right) */
    beam.locations = beam.locations.sort((a, b) => a - b);
    
    /* Refresh Beam drawing */
    drawBeam();
    
    /* Close the support modal*/
    closeModal('support-modal');
    updateToolBar();
}

/**
* Draw a support.
* @param {number} x - Location of the support (local position)
* @param {number} typeIndex - type of support
*/
function drawSupport(x, typeIndex) {
    /* keep local position in memory */
    localX = x;
    /* convert local position into window position */
    x = getXCanvasLocation(x)
    /* Y position of the beam */
    let y = BEAM_Y;
    /* Define supports dimensions in px */
    let supportWidth = canvasWidth/25;
    let triangleWidth = supportWidth*0.8;
    let triangleHeight = triangleWidth;
    
    /* Group multiple shapes into a single group to draw the support */
    let supportDrawing = draw.group()
    
    /* If support is  support type is roller or pined draw a triangle */
    if (typeIndex < 2) {
        /* Draw a triangle */
        triangle = draw.polyline([x,y,x+triangleWidth/2,y+triangleHeight,x-triangleWidth/2,y+triangleHeight,x,y]).fill('none');
        triangle.stroke({ color: '#000', width: 3, linecap: 'round', linejoin: 'round' })
        triangle.fill({ color: '#fff' })
        supportDrawing.add(triangle);
        
        /* If it is a roller, draw wheels */
        if (typeIndex == 0) {
            leftWheel = draw.circle(triangleWidth/4).stroke({ color: '#000', width: 3 }).fill({ color: '#fff' });
            leftWheel.cx(x - triangleWidth / 4).y(y + triangleHeight);
            supportDrawing.add(leftWheel);
            rightWheel = draw.circle(triangleWidth/4).stroke({ color: '#000', width: 3 }).fill({ color: '#fff' });
            rightWheel.cx(x + triangleWidth / 4).y(y + triangleHeight);
            supportDrawing.add(rightWheel);
        } else {
            /* It if is a pinned support, draw hatches */
            const baseWidth = triangleWidth * 1.3;
            const patternWidth = baseWidth / 5;
            const patternHatch = hatch(patternWidth, '#000');
            hatchDrawing = draw.rect(baseWidth, baseWidth/4).cx(x).y(y + triangleHeight).fill(patternHatch)
            base = draw.rect(baseWidth, 3).cy(y + triangleHeight).cx(x);
            supportDrawing.add(hatchDrawing)
            supportDrawing.add(base)
        }
    } else {
        /* Dimension of the fixed support */
        fixedSuppportHeight = supportWidth * 1.3;
        const patternHatch = hatch(fixedSuppportHeight/5, '#000');
        hatchDrawing = draw.rect(fixedSuppportHeight, fixedSuppportHeight/4).cx(x).y(y).fill(patternHatch)
        
        /* If the fixed support is on the left ...*/
        if(localX == 0){
            hatchDrawing.rotate(90, x, y)
        } else {
            /* ... or if it is on the right side of the beam */
            hatchDrawing.rotate(-90, x, y)
        }
        
        /* Eventually, draw the base of the fixed support */
        base = draw.rect(fixedSuppportHeight, 3).cy(y).cx(x).rotate(90);
        supportDrawing.add(hatchDrawing)
        supportDrawing.add(base)
    }
}

/**
* Return a svg hatch pattern
* @param {number} patternWidth 
* @param {string} hatchColor 
*/
function hatch(patternWidth, hatchColor) {
    var pattern = draw.pattern(patternWidth, patternWidth, function(add) {
        const backgroundColor = '#fff';
        const hatchWidth = patternWidth/5;
        add.rect(patternWidth,patternWidth).fill(backgroundColor)
        add.rect(hatchWidth,patternWidth * Math.sqrt(2)).fill(hatchColor).cx(patternWidth/2).cy(patternWidth/2).rotate(45)
        add.rect(hatchWidth,patternWidth * Math.sqrt(2)).fill(hatchColor).cx(0).cy(0).rotate(45)
        add.rect(hatchWidth,patternWidth * Math.sqrt(2)).fill(hatchColor).cx(patternWidth).cy(patternWidth).rotate(45)
    })
    return pattern;
}

/**
* Convert x in beam frame into x in canvas frame
* @param {number} x - x location in beam frame.
*/
function getXCanvasLocation(x){
    return x/beam.length*canvasWidth*beamCanvasRatio + canvasWidth*(1-beamCanvasRatio)/2;
}

/**
* Draw dimensions text in meter.
*/
function drawDimensionsText(){
    for (let i = 0; i < beam.locations.length - 1; i++) {
        const location = beam.locations[i];
        const nextLocation = beam.locations[i+1];
        const cx = getXCanvasLocation((location + nextLocation)/2);
        const dimension = Math.round((nextLocation - location)*100)/100;
        text = draw.text(dimension.toString() + " m").cx(cx).cy(DIMENSION_Y*1.05)
        text.font({ size: FONT_SIZE, anchor: 'right' });   
    }
}

/**
* Return the value of an input or the placeholder
* @param {string} inputId 
*/
function getValueOrPlaceholder(inputId){
    return document.getElementById(inputId).value || document.getElementById(inputId).placeholder;
}

/**
* Control the display in the support modal.
*/
function displaySupportOptions(){
    /* Get the support type */
    /* 0 - Roller, 1 - Pinned, 2 - Fixed */
    supportTypeIndex = document.getElementById('supportType').selectedIndex;
    if(supportTypeIndex < 2) {
        document.getElementById('support-position-input').style.display = 'block';
        document.getElementById('fixed-position-input').style.display = 'none';
    } else {
        document.getElementById('support-position-input').style.display = 'none';
        document.getElementById('fixed-position-input').style.display = 'block';
    }
}

/**
* Create a new ponctual load.
*/
function newForce() {
    /* Get parameters from the view */
    forceLocation = parseFloat(getValueOrPlaceholder('forceLocation'));
    /* Round to cm */
    forceLocation = Math.round(forceLocation*100)/100
    forceMagnitude = parseFloat(getValueOrPlaceholder('forceMagnitude'));
    
    if(forceMagnitude ==  0) {
        alert("L'intensité d'une force ne doit pas être nulle");
        return;
        closeModal('force-modal');
    }

    /* Create the new force object */
    let newForce = { location : forceLocation, magnitude : forceMagnitude }
    
    /* If a force already exists at this location, warn the user */
    if(beam.forces.find(x => x.location == forceLocation)){
        if (confirm('Une force existe déjà à cette position, voulez vous la remplacer ?')) {
            beam.forces.forEach(function(force, index){
                if(force.location == newForce.location){
                    beam.forces[index].magnitude = newForce.magnitude; 
                }
            })  
        }

        drawBeam();
        closeModal('support-modal');
        return;
    }
    
    /* Add the support to the beam object */
    beam.forces.push(newForce);
    
    /* Add a new node location if it does not exist already */
    if(beam.locations.indexOf(forceLocation) == -1){
        beam.locations.push(forceLocation);
    }
    
    /* Sort locations array in ascending order (from left to right) */
    beam.locations = beam.locations.sort((a, b) => a - b);
    
    /* Refresh Beam drawing */
    drawBeam();
    
    closeModal('force-modal');
    updateToolBar();
    
}

function devSetupBeam(){
    beam = {
        "supports": [
            {
                "location": 0,
                "typeIndex": 2
            },
            {
                "location": 2.4,
                "typeIndex": 1
            },
            {
                "location": 4.8,
                "typeIndex": 1
            }
        ],
        "forces": [
            {
                "location": 2,
                "magnitude": -1000
            },
            {
                "location": 3.5,
                "magnitude": -200
            }
        ],
        "loads": [],
        "results": {
            "displacements": [],
            "reactions": []
        },
        "length": 4.8,
        "youngModulus": 210000,
        "inertia": 68.7,
        "locations": [
            0,
            2,
            2.4,
            3.5,
            4.8
        ]
    }
    
    drawBeam();
    updateToolBar();
    /* openModal('debug-modal');*/
}

function compute() {
    /* Parameters of the simulation*/
    const E = beam.youngModulus/10;
    const I = beam.inertia/10000;
    const numberOfNodes = NUMBER_OF_NODES;
    const numberOfElements = numberOfNodes - 1;
    const L = beam.length/(numberOfNodes - 1);
    let nodesLocations = math.range(0, beam.length, L);
    nodesLocations = nodesLocations._data;
    nodesLocations.push(beam.length);
    
    /* Compute globlal stiffness matrix */
    const emptyGlobalStiffnessMatrix = math.zeros(numberOfNodes * 2, numberOfNodes * 2)
    
    let elementStiffnessMatrix = math.matrix([
        [12, 6*L, -12, 6*L],
        [6*L, 4*L**2, -6*L, 2*L**2],
        [-12, -6*L, 12, -6*L],
        [6*L, 2*L**2, -6*L, 4*L**2]
    ]);
    
    elementStiffnessMatrix = math.multiply(elementStiffnessMatrix, E*I/L**3);
    
    const globalStiffnessMatrix = Array(numberOfElements).fill(elementStiffnessMatrix).reduce(function(accumulator, current, index) {
        const rowIndex = math.range(index*2, index*2+4)
        const colIndex = rowIndex;
        let matrixToAdd = math.zeros(numberOfNodes * 2, numberOfNodes * 2); 
        matrixToAdd = math.subset(matrixToAdd, math.index(rowIndex, colIndex), current);
        return math.add(accumulator, matrixToAdd);
    }, emptyGlobalStiffnessMatrix)
    
    /* Compute loading matrix */
    /* Ponctual loads */
    let globalLoadingMatrix = math.zeros(numberOfNodes * 2);
    /* For each force, find the closest nodes then fill the loading matrix */
    beam.forces.forEach(function(force) {
        let F = force.magnitude;
        /* Get the closest node */
        let closestNode = _findClosestNode(force.location)
        let l = closestNode.distance;
        let nodeIndex = closestNode.index;
        
        /* Defining equivalent nodal loads and moments */
        
        if(l < 0) {
            l = math.abs(l);
            globalLoadingMatrix = math.subset(globalLoadingMatrix, math.index(nodeIndex * 2), F * (L - l)/L)
            globalLoadingMatrix = math.subset(globalLoadingMatrix, math.index((nodeIndex - 1) * 2), F * l/L)
            globalLoadingMatrix = math.subset(globalLoadingMatrix, math.index(nodeIndex * 2 + 1), -F * l)
            globalLoadingMatrix = math.subset(globalLoadingMatrix, math.index((nodeIndex - 1) * 2 + 1), F * (L - l))
        } else if(l > 0) {
            globalLoadingMatrix = math.subset(globalLoadingMatrix, math.index(nodeIndex * 2), F * (L - l)/L)
            globalLoadingMatrix = math.subset(globalLoadingMatrix, math.index((nodeIndex + 1) * 2), F * l/L)
            globalLoadingMatrix = math.subset(globalLoadingMatrix, math.index(nodeIndex * 2 + 1), -F * l)
            globalLoadingMatrix = math.subset(globalLoadingMatrix, math.index((nodeIndex + 1) * 2 + 1), F * (L - l))
        } else {
            globalLoadingMatrix = math.subset(globalLoadingMatrix, math.index(nodeIndex * 2), F)
        }
    })
    
    /* Applying boundary conditions */
    let nullDisplacementsIndices = []
    beam.supports.forEach(function(support) {
        let closestNode = _findClosestNode(support.location);
        nullDisplacementsIndices.push(closestNode.index * 2);
        if(support.typeIndex == 2){
            nullDisplacementsIndices.push((closestNode.index * 2) + 1);
        }
    })
    
    indicesToKeep = arrayDifference(nullDisplacementsIndices, math.range(0, numberOfNodes * 2)._data)
    
    /* Reducing number of equations */
    reducedGlobalLoadingMatrix = math.subset(globalLoadingMatrix, math.index(indicesToKeep))
    reducedGlobalStiffnessMatrix = math.subset(globalStiffnessMatrix, math.index(indicesToKeep, indicesToKeep))
    
    /* Computing Displacements */
    emptyDisplacements = math.zeros(numberOfNodes * 2);
    displacements = math.multiply(math.inv(reducedGlobalStiffnessMatrix),reducedGlobalLoadingMatrix);
    displacements = math.subset(emptyDisplacements, math.index(indicesToKeep), displacements);
    
    /* Computing Reactions */
    reactions = math.add(math.multiply(globalStiffnessMatrix, displacements), math.multiply(globalLoadingMatrix, -1));
    reactions = reactions._data.map(x => math.round(x));
    
    beam.supports.forEach(function(support, index){
        let closestNode = _findClosestNode(support.location);
        beam.supports[index].reactionForce = { location: beam.supports[index].location, magnitude: reactions[closestNode.index * 2] }
        beam.supports[index].reactionMoment = { location: beam.supports[index].location, magnitude: reactions[closestNode.index * 2 + 1] }
    })
    
    beam.results['nodesLocations'] = nodesLocations; 
    beam.results['displacements'] = displacements._data; 
    beam.results['reactions'] = reactions;
    
    /**
    * Find the closest node from a point on the beam
    * @param {number} location - location of the point
    */
    function _findClosestNode(location){
        let minDifference = Infinity;
        let minDifferenceIndex = -1;
        nodesLocations.forEach(function(nodeLocation, index){
            locationDifference = location - nodeLocation;
            if(math.abs(locationDifference) < minDifference) {
                minDifference = locationDifference;
                minDifferenceIndex = index;
            }
        })
        return { distance: minDifference, index: minDifferenceIndex }
    }
}

function arrayDifference(array1, array2) {
    difference = [];
    joined = array1.concat(array2);
    for(i = 0; i < joined.length; i++) {
        current = joined[i];
        if(joined.indexOf(current) == joined.lastIndexOf(current)) {
            difference.push(current);
        }
    }
    return difference;
}

function newProject(){
    if (confirm('Cette action va fermer votre projet. Voulez-vous vraiment créer un nouveau projet ?')) {
        location.reload();
    }   
}

function download(text, name, type) {
    var file = new Blob([text], {type: type});
    var isIE = /*@cc_on!@*/false || !!document.documentMode;
    if (isIE)
    {
        window.navigator.msSaveOrOpenBlob(file, name);
    }
    else
    {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = name;
        a.click();
    }
}

function openFile(){
    let reader = new FileReader();
    let selectedFile = document.getElementById('file').files[0];
    reader.onload = onReaderLoad;
    reader.readAsText(selectedFile);
}

function onReaderLoad(event){
    let openedBeam = JSON.parse(event.target.result);
    beam = openedBeam
    updateToolBar();
    drawBeam();
}

function downloadSVG(){
    download(draw.svg(), 'beam_' + new Date().getTime() + '.svg', 'application/svg')
}

function downloadCSV(){
    console.log(beam);
    x = beam.results.nodesLocations
    deflection = getModuloIndices(beam.results.displacements,2,0)
    reactions = getModuloIndices(beam.results.reactions,2,0)
    moments = getModuloIndices(beam.results.reactions,2,1)

    let csvArray = ["x (m), y(mm), reaction (N), moment (N.m)"];
    for (let index = 0; index < x.length; index++) {
        csvArray.push([
            x[index],
            deflection[index],
            reactions[index],
            moments[index]
        ].join(',')); 
    }

    csvArray = csvArray.join('\r\n');
    download(csvArray, 'beam_' + new Date().getTime() + '.csv', 'application/csv')
}