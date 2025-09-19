document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const scoreContainer = document.getElementById('scoreContainer');
    const scoreDiv = document.getElementById('score');
    const scoreLabel = document.getElementById('scoreLabel');
    const shareBtn = document.getElementById('shareBtn');
    const copyBtn = document.getElementById('copyBtn');
    const notification = document.getElementById('notification');
    const drawingHint = document.getElementById('drawingHint');
    
    let isDrawing = false;
    let points = [];
    let currentScore = 0;
    let highScore = localStorage.getItem('perfectCircleHighScore') || 0;
    
    // Set canvas size
    function resizeCanvas() {
        const container = document.querySelector('.canvas-container');
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    }
    
    // Initial resize
    resizeCanvas();
    
    // Resize on window resize
    window.addEventListener('resize', resizeCanvas);
    
    // Touch events for mobile
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    // Mouse events for desktop
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseout', handleMouseUp);
    
    shareBtn.addEventListener('click', shareScore);
    copyBtn.addEventListener('click', copyScore);
    
    function getCanvasCoordinates(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }
    
    function handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
        startDrawing(coords.x, coords.y);
    }
    
    function handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const coords = getCanvasCoordinates(touch.clientX, touch.clientY);
        addPoint(coords.x, coords.y);
    }
    
    function handleTouchEnd(e) {
        e.preventDefault();
        stopDrawing();
    }
    
    function handleMouseDown(e) {
        const coords = getCanvasCoordinates(e.clientX, e.clientY);
        startDrawing(coords.x, coords.y);
    }
    
    function handleMouseMove(e) {
        const coords = getCanvasCoordinates(e.clientX, e.clientY);
        addPoint(coords.x, coords.y);
    }
    
    function handleMouseUp(e) {
        stopDrawing();
    }
    
    function startDrawing(x, y) {
        isDrawing = true;
        points = [];
        points.push({x, y});
        
        // Hide hint and previous score
        drawingHint.classList.add('hide');
        scoreContainer.style.opacity = '0';
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    function addPoint(x, y) {
        if (!isDrawing) return;
        
        points.push({x, y});
        
        // Draw the path
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    
    function stopDrawing() {
        if (!isDrawing) return;
        isDrawing = false;
        
        if (points.length < 10) {
            showNotification("Draw a longer circle!");
            return;
        }
        
        calculateScore();
    }
    
    function calculateScore() {
        // Calculate center of mass (approximate center of the circle)
        let sumX = 0, sumY = 0;
        for (const point of points) {
            sumX += point.x;
            sumY += point.y;
        }
        const centerX = sumX / points.length;
        const centerY = sumY / points.length;
        
        // Calculate average radius
        let sumRadius = 0;
        const radii = [];
        for (const point of points) {
            const dx = point.x - centerX;
            const dy = point.y - centerY;
            const radius = Math.sqrt(dx * dx + dy * dy);
            sumRadius += radius;
            radii.push(radius);
        }
        const avgRadius = sumRadius / points.length;
        
        // 1. Calculate circularity - how much each point deviates from a perfect circle
        let deviationSum = 0;
        for (const point of points) {
            const dx = point.x - centerX;
            const dy = point.y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            deviationSum += Math.abs(distance - avgRadius);
        }
        const avgDeviation = deviationSum / points.length;
        const circularityScore = Math.max(0, 100 - (avgDeviation / avgRadius) * 100);
        
        // 2. Calculate roundness - standard deviation of radii (lower is better)
        let sumVariance = 0;
        for (const radius of radii) {
            sumVariance += Math.pow(radius - avgRadius, 2);
        }
        const variance = sumVariance / radii.length;
        const stdDev = Math.sqrt(variance);
        const roundnessScore = Math.max(0, 100 - (stdDev / avgRadius) * 300);
        
        // 3. Calculate symmetry - check if the shape is evenly distributed around the center
        const angleSegments = 8; // Divide the circle into 8 segments
        const segmentCounts = new Array(angleSegments).fill(0);
        
        for (const point of points) {
            const dx = point.x - centerX;
            const dy = point.y - centerY;
            let angle = Math.atan2(dy, dx);
            
            // Normalize angle to 0-2π
            if (angle < 0) angle += 2 * Math.PI;
            
            // Determine which segment this point falls into
            const segmentIndex = Math.floor(angle / (2 * Math.PI / angleSegments));
            segmentCounts[segmentIndex]++;
        }
        
        // Calculate how evenly distributed the points are
        let segmentSum = 0;
        const avgSegmentCount = points.length / angleSegments;
        for (const count of segmentCounts) {
            segmentSum += Math.abs(count - avgSegmentCount);
        }
        const segmentDeviation = segmentSum / angleSegments;
        const symmetryScore = Math.max(0, 100 - (segmentDeviation / avgSegmentCount) * 100);
        
        // 4. Calculate closure - how close the start and end points are
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        const closureDistance = Math.sqrt(
            Math.pow(lastPoint.x - firstPoint.x, 2) + 
            Math.pow(lastPoint.y - firstPoint.y, 2)
        );
        const closureScore = Math.max(0, 100 - (closureDistance / avgRadius) * 100);
        
        // 5. Calculate smoothness - how sharp the angles are between consecutive points
        let angleSum = 0;
        let angleCount = 0;
        
        for (let i = 1; i < points.length - 1; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];
            const p3 = points[i + 1];
            
            // Calculate vectors
            const v1x = p1.x - p2.x;
            const v1y = p1.y - p2.y;
            const v2x = p3.x - p2.x;
            const v2y = p3.y - p2.y;
            
            // Calculate dot product and magnitudes
            const dotProduct = v1x * v2x + v1y * v2y;
            const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
            const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
            
            if (mag1 > 0 && mag2 > 0) {
                // Calculate angle in radians
                const cosAngle = dotProduct / (mag1 * mag2);
                const angle = Math.acos(Math.min(Math.max(cosAngle, -1), 1));
                
                // Add to sum (180° is a straight line, 0° is a sharp turn)
                angleSum += angle;
                angleCount++;
            }
        }
        
        // Calculate average angle (in radians)
        const avgAngle = angleCount > 0 ? angleSum / angleCount : Math.PI;
        
        // Convert to a score where π (180°) is perfect
        const smoothnessScore = (avgAngle / Math.PI) * 100;
        
        // Weighted average of all scores
        const weights = {
            circularity: 0.3,    // How close to a circle
            roundness: 0.3,      // How consistent the radius is
            symmetry: 0.2,       // How evenly distributed around the center
            closure: 0.1,        // How well it closes
            smoothness: 0.1      // How smooth the curve is
        };
        
        const finalScore = 
            circularityScore * weights.circularity +
            roundnessScore * weights.roundness +
            symmetryScore * weights.symmetry +
            closureScore * weights.closure +
            smoothnessScore * weights.smoothness;
        
        // Round to one decimal place
        currentScore = Math.round(finalScore * 10) / 10;
        
        // Display the result
        displayScore(currentScore);
        
        // Draw the perfect circle for comparison
        ctx.beginPath();
        ctx.arc(centerX, centerY, avgRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    // Function to get color based on score (red to green gradient)
    function getScoreColor(score) {
        // Score is between 0 and 100
        // Red (255, 0, 0) for 0, Yellow (255, 255, 0) for 50, Green (0, 255, 0) for 100
        
        let r, g, b;
        
        if (score < 50) {
            // Red to Yellow (0-50)
            r = 255;
            g = Math.round(255 * (score / 50));
            b = 0;
        } else {
            // Yellow to Green (50-100)
            r = Math.round(255 * (1 - (score - 50) / 50));
            g = 255;
            b = 0;
        }
        
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    function displayScore(score) {
        scoreDiv.textContent = `${score}%`;
        
        // Set color based on score
        const color = getScoreColor(score);
        scoreDiv.style.color = color;
        
        scoreContainer.style.opacity = '1';
        
        // Check if it's a new high score
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('perfectCircleHighScore', highScore);
            scoreLabel.textContent = "New best score";
            scoreLabel.classList.add('show');
        } else {
            scoreLabel.textContent = "";
            scoreLabel.classList.remove('show');
        }
    }
    
    function shareScore() {
        if (currentScore === 0) {
            showNotification("Draw a circle first!");
            return;
        }
        
        const text = `I just scored ${currentScore}% on the {Circle} game! Can you beat my score?`;
        
        // Check if Web Share API is available
        if (navigator.share) {
            navigator.share({
                title: '{Circle} Game',
                text: text,
                url: window.location.href
            })
            .then(() => console.log('Shared successfully'))
            .catch((error) => console.log('Error sharing:', error));
        } else {
            // Fallback to Twitter if Web Share API is not available
            const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
            window.open(url, '_blank');
        }
    }
    
    function copyScore() {
        if (currentScore === 0) {
            showNotification("Draw a circle first!");
            return;
        }
        
        const text = `I just scored ${currentScore}% on the {Circle} game!`;
        
        // Copy to clipboard
        navigator.clipboard.writeText(text).then(() => {
            showNotification("Copied to clipboard!");
        }).catch(err => {
            showNotification("Failed to copy!");
            console.error('Could not copy text: ', err);
        });
    }
    
    function showNotification(message) {
        notification.textContent = message;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 2000);
    }
    
    // Initialize the game
    function init() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        scoreContainer.style.opacity = '0';
    }
    
    init();
});
