# Build the 2x working sprite (decontaminated RGBA) and the motion weight maps.
import numpy as np, cv2
from PIL import Image
import os
S=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')+'/'
K=2  # working scale vs original 1232x1632
x4=np.asarray(Image.open(S+'cut/nea_x4.png').convert('RGB')).astype(np.float32)/255
W0,H0=1232,1632; W,H=W0*K,H0*K
rgb=cv2.resize(x4,(W,H),interpolation=cv2.INTER_AREA)
a0=np.asarray(Image.open(S+'cut/nea_clean.png'))[...,3].astype(np.float32)/255
a=cv2.resize(a0,(W,H),interpolation=cv2.INTER_CUBIC).clip(0,1)
a=cv2.erode(a,np.ones((3,3),np.uint8))  # pull in the grey fringe a bit
B=219/255
m=(a>0.02)&(a<0.98)
rgb[m]=((rgb[m]-(1-a[m,None])*B)/a[m,None]).clip(0,1)
rgb[a<=0.02]=0
out=np.dstack([rgb,a])
np.save(S+'cut/sprite2x.npy',(out*255).round().astype(np.uint8))
Image.fromarray((out*255).round().astype(np.uint8)).save(S+'cut/sprite2x.png')

# ---- weight maps (in original coords, then upscaled) ----
yy,xx=np.mgrid[0:H0,0:W0].astype(np.float32)
def ss(e0,e1,v):
    t=np.clip((v-e0)/(e1-e0),0,1); return t*t*(3-2*t)
# right hair mass
hr=np.zeros((H0,W0),np.float32)
cv2.fillPoly(hr,[np.array([(830,330),(890,330),(1010,470),(1180,580),(1180,900),(930,900),(845,830),(835,600)],np.int32)],1)
hr*=ss(540,840,yy)*ss(820,1000,xx)
# left hair mass
hl=np.zeros((H0,W0),np.float32)
cv2.fillPoly(hl,[np.array([(330,520),(400,560),(395,760),(330,860),(110,860),(100,700),(200,560)],np.int32)],1)
hl*=ss(540,800,yy)*ss(400,220,xx)
cv2.circle(hl,(385,840),95,0,-1)  # keep sword hilt rigid
# strands framing the face
hf=np.zeros((H0,W0),np.float32)
cv2.fillPoly(hf,[np.array([(480,120),(540,120),(560,470),(500,470)],np.int32)],1)
cv2.fillPoly(hf,[np.array([(680,140),(730,140),(760,470),(700,470)],np.int32)],1)
hf*=ss(150,460,yy)*0.35
# coat hem flaps
coat=np.zeros((H0,W0),np.float32)
cv2.fillPoly(coat,[np.array([(280,1000),(440,1000),(430,1470),(280,1460)],np.int32)],1)
cv2.fillPoly(coat,[np.array([(790,1000),(960,1000),(990,1470),(820,1470)],np.int32)],1)
coat*=ss(1080,1460,yy)
# sword must not bend: zero along blade line
p0=np.array([455,830.]);p1=np.array([60,1470.]);v=p1-p0;L=np.linalg.norm(v)
t=np.clip(((xx-p0[0])*v[0]+(yy-p0[1])*v[1])/L**2,0,1)
dist=np.hypot(xx-(p0[0]+t*v[0]),yy-(p0[1]+t*v[1]))
rig=ss(18,60,dist)
coat*=rig; hl*=np.maximum(rig,ss(0,1,(yy<760).astype(np.float32)))
def soft(m,s): return cv2.GaussianBlur(m,(0,0),s)
maps={k:cv2.resize(soft(m,s),(W,H),interpolation=cv2.INTER_LINEAR) for k,m,s in
      [('hr',hr,14),('hl',hl,14),('hf',hf,10),('coat',coat,16)]}
np.savez(S+'cut/weights2x.npz',**maps)
viz=np.zeros((H0,W0,3),np.float32); viz[...,0]=soft(hr,14)+soft(hf,10); viz[...,1]=soft(hl,14); viz[...,2]=soft(coat,16)
base=a0[...,None]*0.35
Image.fromarray(((viz*0.8+base).clip(0,1)*255).astype(np.uint8)).resize((616,816)).save(S+'cut/weights_viz.png')
print('ok',W,H)
