var MDPaint=(function(){
"use strict";
//Variables
let controls={},effects={},tools={},scale=1,

//Helper Functions
elt=(t,a,...h)=>{let d=document.createElement(t);for(t in a)d.setAttribute(t,a[t]);for(a of h)d.append(typeof a=="string"?document.createTextNode(a):a);return d},
relativePos=(e,el)=>{let r=el.getBoundingClientRect();e=e.touches?e.touches[0]:e;return{x:~~(e.clientX-r.left),y:~~(e.clientY-r.top)}},//figures out canvas relative coordinates for accurate functionality
trackDrag=(onMove,onEnd)=>{//registers and unregisters listeners for tools
	let end=e=>{
		removeEventListener('mousedown',onMove);
		removeEventListener('mousemove',onMove);
		removeEventListener('mouseup',end);
		removeEventListener('touchstart',onMove);
		removeEventListener('touchmove',onMove);
		removeEventListener('touchend',end);
		if(onEnd)onEnd(e);
	}
	addEventListener('mousedown',onMove);
	addEventListener('mousemove',onMove);
	addEventListener('mouseup',end);
	addEventListener('touchstart',onMove);
	addEventListener('touchmove',onMove);
	addEventListener('touchend',end);
},
loadImageURL=(cx,url)=>{//loads an image from a URL and replaces the contents of the canvas
	let image = elt('img',{src:url});
	image.crossOrigin = "Anonymous";
	image.addEventListener('load',()=>{
		let c=cx.fillStyle,s=cx.lineWidth;cx.save();
		cx.canvas.width = image.width;
		cx.canvas.height = image.height;
		cx.drawImage(image,0,0);
		cx.fillStyle=cx.strokeStyle=c;cx.lineWidth=s;cx.restore();
	});
},
rndPointInRad=r=>{//used by spray tool to randomly position dots
	let x,y;for(;;){x=Math.random()*2-1,y=Math.random()*2-1;if(x*x+y*y<1)return{x:x*r,y:y*r}}//uses Pythagoras theorem to test if a point is inside a circle
},
rgba2hex=x=>{return "#"+x.replace(/[^\d,]/g,'').split(',').map(x=>(x|1<<8).toString(16).slice(1)).join('')},
rgb2hsl=(r,g,b)=>{
	r /= 255; g /= 255; b /= 255;
	let max = Math.max(r,g,b);
	let min = Math.min(r,g,b);
	let d = max - min;
	let h;
	if (d == 0) h = 0;
	else if (max == r) h = (g - b) / d % 6;
	else if (max == g) h = (b - r) / d + 2;
	else if (max == b) h = (r - g) / d + 4;
	let l = (min + max) / 2;
	let s = d == 0 ? 0:d / (1 - Math.abs(2 * l - 1));
	return [h*60,s,l];
},
hsl2rgb=(h,s,l)=>{
	let hp = h/60;
	let c=(1 - Math.abs(2 * l - 1)) * s;
	let x=c * (1 - Math.abs((hp % 2) - 1));
	let m=l-c*0.5;
	c=Math.round(255*(c+m))
	x=Math.round(255*(x+m))
	if (isNaN(h)) return [0,0,0];
	else if (hp <= 1) return [c,x,0];
	else if (hp <= 2) return [x,c,0];
	else if (hp <= 3) return [0,c,x];
	else if (hp <= 4) return [0,x,c];
	else if (hp <= 5) return [x,0,c];
	else if (hp <= 6) return [c,0,x];
},
forEachNeighbor=(p,fn)=>{
	fn({x:p.x-1,y:p.y});
	fn({x:p.x+1,y:p.y});
	fn({x:p.x,y:p.y-1});
	fn({x:p.x,y:p.y+1});
},
isSameColor=(d,p1,p2)=>{
	let i=4,o1=(p1.x+p1.y*d.width)*4,o2=(p2.x+p2.y*d.width)*4;
	for(;i--;)if(d.data[o1+i] != d.data[o2+i])return 0
	return 1;
}

//Controls
controls.tool=cx=>{
	let select = elt('select');
	for (let name in tools)select.append(elt('option',{},name));
	let executeTool=e=>{
		if (e.which == 1 || e.which == 3 || e.touches){tools[select.value](e,cx);e.preventDefault()}
	}
	cx.canvas.addEventListener('mousedown',executeTool);
	cx.canvas.addEventListener('touchstart',executeTool);
	select.addEventListener('wheel',e=>{
		e.preventDefault();
		if (e.deltaY > 0 && select.selectedIndex < select.length-1){select.selectedIndex++}
		else if (e.deltaY < 0 && select.selectedIndex > 0){select.selectedIndex--}
	});
	window.addEventListener('keydown',e=>{//fix stupid select tool instead of ctrl/shift/alt command
		if (e.ctrlKey){
			if (e.key.toUpperCase() == "Z"){
				e.preventDefault();
				alert("Undo Feature Is not avaiable for now");
			}
			else if (e.key.toUpperCase() == "Y"){
				e.preventDefault();
				alert("Redo Feature Is not avaiable for now");
			}
			else if (e.key.toUpperCase() == "O"){
				e.preventDefault();
				let fr,input = elt('input',{type:'file',accept:'image/*',style:'display:none'});input.click();
				input.addEventListener('change',()=>{
					fr=new FileReader();
					fr.readAsDataURL(input.files[0]);
					fr.onload=()=>{loadImageURL(cx,fr.result);fr=null;input=""};
				});
			}
			else if (e.key.toUpperCase() == "S"){
				e.preventDefault();
				let fileFormat = "image/png";
				if(e.shiftKey){fileFormat = prompt("Save As Format:","image/png")}
				alert("You May Receive 'Window Popup Blocked' Message");
				elt('a',{href:cx.canvas.toDataURL(fileFormat),download:"image.png",target:'_blank'}).click()
			}
		}
		else {
			if (e.key.toUpperCase() == 'B'){select.selectedIndex=0}
			else if (e.key.toUpperCase() == 'E'){select.selectedIndex=1}
			else if (e.key.toUpperCase() == 'T'){select.selectedIndex=2}
			else if (e.key.toUpperCase() == 'S'){select.selectedIndex=3}
			else if (e.key.toUpperCase() == 'O'){
				if(select.selectedIndex == 5){select.selectedIndex=6}
				else if(select.selectedIndex == 4){select.selectedIndex=5}
				else{select.selectedIndex=4}
			}
			else if (e.key.toUpperCase() == 'K'){select.selectedIndex=8}
			else if (e.key.toUpperCase() == 'R'){select.selectedIndex=9}
			else if (e.key.toUpperCase() == 'F'){
				if(select.selectedIndex == 10){select.selectedIndex=11}
				else{select.selectedIndex=10}
			}
			else if (e.key.toUpperCase() == 'G'){
				if(select.selectedIndex == 14){select.selectedIndex=7}
				else if(select.selectedIndex == 13){select.selectedIndex=14}
				else if(select.selectedIndex == 12){select.selectedIndex=13}
				else{select.selectedIndex=12}
			}
		}
	});
	return elt('span',{},'Tool:',select);
};
controls.effect=cx=>{
	let options = elt('div',{id:'myDropdown',class:'dropdown-content'}),effectsElm;
	for(let name in effects){
		effectsElm=elt('button',{},name);
		effectsElm.onclick=x=>{effects[name](cx)};
		options.append(effectsElm);
	}
	window.addEventListener('click',e=>{
		if (!e.target.matches('.dropbtn')){
			let d = document.getElementsByClassName("dropdown-content"),i=d.length;
			for(;i--;)if(d[i].classList.contains('show'))d[i].classList.remove('show');
		}
	})
	return elt('div',{class:'dropdown'},
		elt('button',{onclick:'myDropdown.classList.toggle("show")',class:'dropbtn'},"Effects"),
		options
	);
};
controls.color=cx=>{
	var inputColor1 = elt('input',{type:'color',style:'background:#000',value:'#000000',id:'inputColor1'}),
			inputColor2 = elt('input',{type:'color',style:'background:#fff',value:'#ffffff',id:'inputColor2'});
	inputColor1.addEventListener('change',()=>{cx.fillStyle=cx.strokeStyle=inputColor1.style.background=inputColor1.value});
	inputColor2.addEventListener('change',()=>{cx.fillStyle=cx.strokeStyle=inputColor2.style.background=inputColor2.value});
	return elt('span',{},'Color:',inputColor1,inputColor2);
};
controls.brushSize=cx=>{
	let select = elt('select');
	let sizes = [1,2,3,5,8,12,25,35,50,75,100];//Various brush sizes
	sizes.forEach(s=>{select.append(elt('option',{value:s},s+'px'))});//build up a select group of size options
	select.addEventListener('change',()=>{cx.lineWidth=select.value});
	select.addEventListener('wheel',e=>{
		if (e.deltaY > 0 && select.selectedIndex < select.length-1){select.selectedIndex++}
		else if (e.deltaY < 0 && select.selectedIndex > 0){select.selectedIndex--}
		cx.lineWidth = select.value
	});
	select.selectedIndex=cx.lineWidth=5
	return elt('span',{},'Brush size:',select);
};
controls.resAdjust=cx=>{
	let canvasWidthInput = elt('input',{type:'number',placeholder:'Width',value:500,min:1,onwheel:'this.focus()'}),
			canvasHeightInput = elt('input',{type:'number',placeholder:'Height',value:300,min:1,onwheel:'this.focus()'});
	canvasWidthInput.addEventListener('input',x=>{let c=cx.fillStyle,s=cx.lineWidth,i=cx.getImageData(0,0,cx.canvas.width,cx.canvas.height);cx.save();cx.canvas.width=canvasWidthInput.value;cx.restore();cx.fillStyle=cx.strokeStyle=c;cx.lineWidth=s;cx.putImageData(i,0,0)});
	canvasHeightInput.addEventListener('input',x=>{let c=cx.fillStyle,s=cx.lineWidth,i=cx.getImageData(0,0,cx.canvas.width,cx.canvas.height);cx.save();cx.canvas.height=canvasHeightInput.value;cx.restore();cx.fillStyle=cx.strokeStyle=c;cx.lineWidth=s;cx.putImageData(i,0,0)});
	return elt('span',{},canvasWidthInput,canvasHeightInput);
};
controls.save=cx=>{
	let link = elt('a',{href:'/',target:'_blank'},elt('button',{},'Save')),//MUST open in a new window because of iframe security stuff
			update=x=>{
		try {
			link.href = cx.canvas.toDataURL("image/png");
		} catch(e){
			//some browsers choke on big data URLs
			//also,if the server response doesn't include a header that tells the browser it
			//can be used on other domains,the script won't be able to look at it;
			//this is in order to prevent private information from leaking to a script;
			//pixel data,data URL or otherwise,cannot be extracted from a "tainted canvas"
			//and a SecurityError is thrown
			if(e instanceof SecurityError){link.href = 'javascript:alert('+JSON.stringify('Can\'t save:'+e.toString())+')'}
			else{throw e}
		}
	}
	link.addEventListener('mouseover',update);
	link.addEventListener('focus',update);
	return link;
};
controls.openFile=cx=>{
	let fr,input = elt('input',{type:'file',accept:'image/*',style:'display:none'});
	input.addEventListener('change',()=>{
		if(!input.files.length)return;
		fr=new FileReader();
		fr.readAsDataURL(input.files[0]);
		fr.onload=()=>{loadImageURL(cx,fr.result);fr=null};
	});
	return elt('button',{},elt('label',{},'Open file',input));
};
controls.openURL=cx=>{
	let form = elt('form',{},elt('input',{type:'text',placeholder:'Open URL'}),elt('button',{type:'submit'},'Load'));
	form.addEventListener('submit',e=>{e.preventDefault();loadImageURL(cx,form.querySelector('input').value)});
	return form;
};

//Effects
effects.Invert=cx=>{
	let iDt = cx.getImageData(0,0,cx.canvas.width,cx.canvas.height),d=iDt.data,i=d.length;
	for(;i-=4;){
		d[i]	 = 255-d[i];
		d[i+1] = 255-d[i+1];
		d[i+2] = 255-d[i+2];
	}
	cx.putImageData(iDt,0,0);
};
effects["Invert Light"]=cx=>{
	let iDt = cx.getImageData(0,0,cx.canvas.width,cx.canvas.height),d=iDt.data,i=d.length,tmp1;
	for(;i-=4;){
		tmp1 = rgb2hsl(d[i],d[i+1],d[i+2]);
		tmp1[2] = 1-tmp1[2];
		[d[i],d[i+1],d[i+2]] = hsl2rgb(tmp1[0],tmp1[1],tmp1[2]);
	}
	cx.putImageData(iDt,0,0);
};
effects.Sepia=cx=>{//min:0,max:30
	let iDt = cx.getImageData(0,0,cx.canvas.width,cx.canvas.height),d=iDt.data,i=d.length,r,g,b,o=(prompt("Sepia Level","10")||10)*255/100;
	for(;i-=4;){
		r=g=b=d[i]*0.3+d[i+1]*0.59+d[i+2]*0.11;
		d[i] = r+40;
		d[i+1] = g+20;
		d[i+2] = b-o;
	}
	cx.putImageData(iDt,0,0);
}
effects.Opacity=cx=>{
	let iDt = cx.getImageData(0,0,cx.canvas.width,cx.canvas.height),d=iDt.data,i=d.length,o=(prompt("Opacity:","1")||1)*255;
	for(;i-=4;)if(d[i+3]>0)d[i+3]=o;
	cx.putImageData(iDt,0,0);
};
effects.Grayscale=cx=>{
	let iDt = cx.getImageData(0,0,cx.canvas.width,cx.canvas.height),d=iDt.data,i=d.length;
	for(;i-=4;)d[i]=d[i+1]=d[i+2]=0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2];
	cx.putImageData(iDt,0,0);
};
effects.Noise=cx=>{
	let iDt = cx.getImageData(0,0,cx.canvas.width,cx.canvas.height),d=iDt.data,i=d.length,n,o=prompt("Noise Intensity:","100")||100;
	for(;i-=4;){
		n = ~~((2*Math.random()-1)*o);
		d[i] += n;
		d[i+1] += n;
		d[i+2] += n;
	}
	cx.putImageData(iDt,0,0);
};
effects.Threshold=cx=>{
	let iDt = cx.getImageData(0,0,cx.canvas.width,cx.canvas.height),d=iDt.data,i=d.length,v,
		clr1=prompt("Color 1:","255"),
		clr2=prompt("Color 2:","0"),
		thrshld=prompt("Threshold:","128");
	for(;i-=4;){
		if(d[i+3] > 0)d[i]=d[i+1]=d[i+2]=(0.2126*d[i] + 0.7152*d[i+1] + 0.0722*d[i+2] >= thrshld) ? clr1:clr2;
	}
	cx.putImageData(iDt,0,0);
};
effects.Vignette=cx=>{
	let width=cx.canvas.width,height=cx.canvas.height,grd = cx.createRadialGradient(width/2,height/2,0,width/2,height/2,Math.sqrt(Math.pow(width/2,2)+Math.pow(height/2,2)));
	grd.addColorStop(0,'rgba(0,0,0,0)');
	grd.addColorStop(0.5,'rgba(0,0,0,0)');
	grd.addColorStop(1,'rgba(0,0,0,'+(prompt("Vignette","0.3")||0.3)+')');
	cx.fillStyle = grd;
	cx.fillRect(0,0,width,height);
}
effects.Rotate=cx=>{//todo: fix thr rotate bug | hint: putImgData Not Affected By Transformation Matrix (rotate,translate,ans thingiz), fix by drawing to offscreen canvas then use drawImage(offscrnCanv)
	iDt=cx.getImageData(0,0,cx.canvas.width,cx.canvas.height);
	cx.clearRect(0,0,cx.canvas.width,cx.canvas.height);
	cx.save();

//these code does'nt affect imagedata
	cx.translate(cx.canvas.width/2,cx.canvas.height/2);
	cx.rotate((prompt("Rotate to (deg):","90")||90)*Math.PI/180);
//cx.translate(-cx.canvas.width/2,-cx.canvas.height/2);

	cx.putImageData(iDt,-cx.canvas.width/2,-cx.canvas.height/2);//iDt,0,0
	cx.restore();
}

//Tools
//tools['Tool Name Here']=(event,canvasContext)
tools.Brush=(e,cx,onEnd)=>{
	cx.canvas.style.cursor="crosshair";
	cx.lineCap = 'round';
	let pos = relativePos(e,cx.canvas);
	trackDrag(e=>{
		cx.beginPath();
		cx.moveTo(pos.x,pos.y);
		pos = relativePos(e,cx.canvas);
		cx.lineTo(pos.x,pos.y);
		cx.stroke();
	},onEnd);
};
tools.Erase=(e,cx)=>{
	//globalCompositeOperation determines how drawing operations
	//on a canvas affect what's already there
	//'destination-out' makes pixels transparent,'erasing' them
	//NOTE:this has been deprecated
	cx.globalCompositeOperation = 'destination-out';
	tools.Brush(e,cx,()=>{cx.globalCompositeOperation = 'source-over'});
};
tools.Text=(e,cx)=>{
	cx.canvas.style.cursor="";
	let text = prompt('Text:',''),font = prompt('Font:',Math.max(7,cx.lineWidth) + 'px sans-serif');
	font = !font ? Math.max(7,cx.lineWidth) + 'px sans-serif':font
	if (text){
		let pos = relativePos(e,cx.canvas);
		cx.textBaseline = 'middle';
		cx.textAlign = 'center';
		cx.font = font;
		cx.fillText(text,pos.x,pos.y);
	}
}
tools.Spray=(e,cx)=>{
	cx.canvas.style.cursor="";
	let r=cx.lineWidth / 2,i,o,
			dotPerMs=Math.ceil(r*r*Math.PI/30),
			pos=relativePos(e,cx.canvas),
			s=setInterval(()=>{
		for(i=dotPerMs;i--;){
			o=rndPointInRad(r);
			cx.fillRect(pos.x + o.x,pos.y + o.y,1,1);
		}
	},25);
	trackDrag(e=>{pos=relativePos(e,cx.canvas)},()=>{clearInterval(s)});
};
tools['Shape (Rectangle)']=(e,cx)=>{
	cx.canvas.style.cursor="crosshair";
	let RPos,pos,posInit=pos=relativePos(e,cx.canvas),imageData = cx.getImageData(0,0,cx.canvas.width,cx.canvas.height);
	trackDrag(e=>{
		cx.putImageData(imageData,0,0);
		pos = relativePos(e,cx.canvas);
		cx.fillRect(posInit.x,posInit.y,pos.x-posInit.x,pos.y-posInit.y);
	});
};
tools['Shape (Circle)']=(e,cx)=>{
	cx.canvas.style.cursor="crosshair";
	let RPos,pos,posInit=pos=relativePos(e,cx.canvas),imageData = cx.getImageData(0,0,cx.canvas.width,cx.canvas.height);
	trackDrag(e=>{
		cx.putImageData(imageData,0,0);
		cx.beginPath();
		pos = relativePos(e,cx.canvas);
		RPos = Math.hypot(posInit.x-pos.x,posInit.y-pos.y);
		cx.arc(posInit.x,posInit.y,RPos,0,2*Math.PI);
		cx.fill();
	});
}
tools['Shape (Line)']=(e,cx)=>{
	cx.canvas.style.cursor="crosshair";
	let pos,posInit=pos=relativePos(e,cx.canvas),imageData = cx.getImageData(0,0,cx.canvas.width,cx.canvas.height);
	cx.lineCap = 'round';
	trackDrag(e=>{
		cx.putImageData(imageData,0,0);
		pos = relativePos(e,cx.canvas);
		cx.beginPath();
		cx.moveTo(posInit.x,posInit.y);
		cx.lineTo(pos.x,pos.y);
		cx.stroke();
	});
};
tools['Gradient Color Configuration']=(e,cx)=>{
cx.canvas.style.cursor="crosshair";
let grd,pos,posInit=pos=relativePos(e,cx.canvas),imageData = cx.getImageData(0,0,cx.canvas.width,cx.canvas.height);
	trackDrag(e=>{
		grd = cx.createLinearGradient(posInit.x,posInit.y,pos.x,pos.y);
		grd.addColorStop(0,inputColor1.value);grd.addColorStop(1,inputColor2.value);
		pos = relativePos(e,cx.canvas);
		cx.fillStyle=grd;
		cx.fillRect(0,0,cx.canvas.width,cx.canvas.height);
	},e=>cx.putImageData(imageData,0,0));
};
tools.Colorpicker=(e,cx)=>{//TODO:rewrite with pixel object
	cx.canvas.style.cursor="";
	let p = relativePos(e,cx.canvas),
			cv = cx.getImageData(p.x,p.y,1,1).data,//returns an array [r,g,b,a];
			curMBtn = e.which,
			c = 'rgba(';
	for(let i=0;i<4;i++){c += cv[i];if(i<3)c += ','}
	c += ')';
	cx.fillStyle=cx.strokeStyle=c;
	if(curMBtn == 1){inputColor1.value=rgba2hex(c);inputColor1.style.background=c}
	if(curMBtn == 3){inputColor2.value=rgba2hex(c);inputColor2.style.background=c}
	trackDrag(e=>{
		let p = relativePos(e,cx.canvas),
				cv = cx.getImageData(p.x,p.y,1,1).data,
				c = 'rgba(';
		for(let i=0;i<4;i++){c += cv[i];if(i<3)c += ','}
		c += ')';
		cx.fillStyle=cx.strokeStyle=c;
		if(curMBtn == 1){inputColor1.value=rgba2hex(c);inputColor1.style.background=c}
		if(curMBtn == 3){inputColor2.value=rgba2hex(c);inputColor2.style.background=c}
	});
};
tools['Recolor (BETA)']=(e,cx)=>{
	cx.canvas.style.cursor="crosshair";
	cx.lineCap = 'round';
	let i,pos,posSample=pos=relativePos(e,cx.canvas),
			cv,cv_old=cv=cx.getImageData(pos.x,pos.y,1,1).data;
	trackDrag(e=>{
		cv=cx.getImageData(posSample.x,posSample.y,1,1).data;
		posSample = relativePos(e,cx.canvas)
		for(i=4;i--;)if(cv_old[i]!=cv[i])return//[r,g,b,a] => r,g,b
		cx.beginPath();
		cx.moveTo(pos.x,pos.y);
		pos = relativePos(e,cx.canvas);
		cx.lineTo(pos.x,pos.y);
		cx.stroke();
	});
};
tools.Fill=(e,cx)=>{
	cx.canvas.style.cursor="";
	let imageData = cx.getImageData(0,0,cx.canvas.width,cx.canvas.height),
			sample = relativePos(e,cx.canvas),
			isPainted = new Array(imageData.width * imageData.height),
			toPaint = [sample];
	while(toPaint.length){
		let cur = toPaint.pop(),id = cur.x + cur.y * imageData.width;
		if (isPainted[id]) continue;
		else {cx.fillRect(cur.x,cur.y,1,1);isPainted[id] = true}//if it hasn't,paint cur and set isPainted to true
		forEachNeighbor(cur,n=>{if (n.x >= 0 && n.x < imageData.width && n.y >= 0 && n.y < imageData.height && isSameColor(imageData,sample,n)){toPaint.push(n)}});//for every neighbor (new function)
	}
};
tools['Fill (Global)']=(e,cx)=>{
	cx.canvas.style.cursor="";
	let w=cx.canvas.width,h=cx.canvas.height,x,y,imageData=cx.getImageData(0,0,w,h),p=relativePos(e,cx.canvas);
	for(x=w;x--;)for(y=h;y--;)if(isSameColor(imageData,p,{x,y}))cx.fillRect(x,y,1,1);
};
tools['Gradient (Linear)']=(e,cx)=>{
	cx.canvas.style.cursor="";
	let grd,pos,posInit=pos=relativePos(e,cx.canvas)
	trackDrag(e=>{
		grd = cx.createLinearGradient(posInit.x,posInit.y,pos.x,pos.y);
		grd.addColorStop(0,inputColor1.value);grd.addColorStop(1,inputColor2.value);
		pos = relativePos(e,cx.canvas);
		cx.fillStyle=grd;
		cx.fillRect(0,0,cx.canvas.width,cx.canvas.height);
	});
}
tools['Gradient (Radial)']=(e,cx)=>{
	cx.canvas.style.cursor="";
	let RPos,pos,grd,posInit=pos=relativePos(e,cx.canvas)
	trackDrag(e=>{
		RPos = Math.hypot(posInit.x-pos.x,posInit.y-pos.y);
		grd = cx.createRadialGradient(posInit.x,posInit.y,0,posInit.x,posInit.y,RPos);
		grd.addColorStop(0,inputColor1.value);grd.addColorStop(1,inputColor2.value);
		pos = relativePos(e,cx.canvas);
		cx.fillStyle=grd;
		cx.fillRect(0,0,cx.canvas.width,cx.canvas.height);
	});
}
/*tools['Gradient (Radial, beta, for fun)']=(e,cx)=>{
	cx.canvas.style.cursor="";
	let grd,pos,posInit=pos=relativePos(e,cx.canvas)
	trackDrag(e=>{
		grd = cx.createRadialGradient(posInit.x,posInit.y,0,pos.x,pos.y,100);
		grd.addColorStop(0,inputColor1.value);
		grd.addColorStop(1,inputColor2.value);
		pos = relativePos(e,cx.canvas);
		cx.fillStyle=grd;
		cx.fillRect(0,0,cx.canvas.width,cx.canvas.height);
	});
}*/

//Accesible APIs
return {
	create:p=>{
	//create canvas,tools,container,etc...
		let canvas = elt('canvas',{width:500,height:300}),
				cx = canvas.getContext('2d'),
				toolbar = elt('div',{class:'toolbar'});
	//prepare all the tools and put them to toolbar
		for(name in controls)toolbar.append(controls[name](cx));
	//we want to use 2nd color like paint.net, so we need to block the context-menu event so we can drag to draw using RMB
	//2nd paint cant be used with touch input.
		canvas.oncontextmenu=e=>{if(e.which==3){e.preventDefault();return false}};
	//mousedown event for 1st and 2nd paint
		canvas.addEventListener('mousedown',e=>{
			if(e.which == 1){cx.fillStyle=cx.strokeStyle=inputColor1.value}
			else if(e.which == 3){cx.fillStyle=cx.strokeStyle=inputColor2.value}
		})
	//append all of this to p
		p.append(toolbar);
		p.append(elt('div',{class:'picturepanel'},canvas));
	}
}
})
/*
	MDPaint, A modular canvas painting tool. By MDP43140 (original by Marijn Haverbeke: https://eloquentjavascript.net/2nd_edition/19_paint.html)

	Changelog:
	+ Added Invert Brightness (good for changing gui theme from bright to dark)(Thanks vahidk for rgbToHsl and hslToRgb codes: https://gist.github.com/vahidk/05184faf3d92a0aa1b46aeaa93b07786).
	+ Improved Compatibility & Security by adding "use strict".
	+ Some Bug Caused By "use strict" has been fixed.
	+ Bug Fixed: securityError when trying to 'read' URL Image (by changing the image crossOrigin to Anonymous).
	+ Bug Fixed: Default Canvas Behaviour Prevented when changing resolution (by default canvas will clear if resolution changes. we can trick this using imageData)
	+ Bug Fixed: @L334 @L434 (Radial Gradient Size not accurate, fixed by changing the math slightly).
	+ Bug Fixed: Pressing Ctrl+[] instead acts like pressing only [] (example: ctrl+o should open image, but its going to shape instead).
	+ Bug Fixed: certain os/browser scroll when scrolling on selection which it should'nt happened (added e.PreventDefault()).
	+ faster response when pressing key shortcut (applied some optimizations).
	. Adding Custom Window for effect properties (using windowEngine).
	. Adding Zoom System (using scale variable).
	. Adding Offscreen canvas.
	- Compatibility Problem: @L334 @L434 (uses Math.hypot(), which not compatible with ie and some older browsers, recommended to include this before loading any script: <script src="https://polyfill.io/v3/polyfill.js" crossorigin="Anonymous"></script>).
	- Bug Found: Rotate 'effect' does'nt work (putImageData does'nt affected by transformation matrix, this includes rotation & transform, maybe offscreen canvas will fix the bug??).
	- Bug Found: Gaussian Blur Effect does'nt work (maybe offscreen canvas will fix the bug??).
	- Recolor Bug: try to use it, u'll know the bug (caused by ctx.moveTo and ctx.lineTo, dk how to fixing it, maybe getImageData then modify it??).
*/