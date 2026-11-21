import numpy as np, cv2, os
from PIL import Image
S=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')+'/'
K=2; W0,H0=1232,1632; W,H=W0*K,H0*K
x4=np.asarray(Image.open(S+'sy/x4.png').convert('RGB')).astype(np.float32)/255
rgb=cv2.resize(x4,(W,H),interpolation=cv2.INTER_AREA)
cl=np.asarray(Image.open(S+'sy/clean.png')).astype(np.float32)/255
a0=cl[...,3]
a=cv2.resize(a0,(W,H),interpolation=cv2.INTER_CUBIC).clip(0,1)
a=cv2.erode(a,np.ones((3,3),np.uint8))
B=np.array([74,114,76],np.float32)/255; m=(a>0.02)&(a<0.98)
rgb[m]=((rgb[m]-(1-a[m,None])*B)/a[m,None]).clip(0,1)
lim=np.maximum(rgb[...,0],rgb[...,2]); edge=(a<0.98)
rgb[...,1]=np.where(edge,np.minimum(rgb[...,1],lim*1.02),rgb[...,1])   # despill
rgb[a<=0.02]=0
np.save(S+'sy/sprite2x.npy',(np.dstack([rgb,a])*255).round().astype(np.uint8))
yy,xx=np.mgrid[0:H0,0:W0].astype(np.float32)
def ss(e0,e1,v):
    t=np.clip((v-e0)/(e1-e0),0,1); return t*t*(3-2*t)
def poly(pts):
    m=np.zeros((H0,W0),np.float32); cv2.fillPoly(m,[np.array(pts,np.int32)],1); return m
def segdist(p0,p1):
    p0=np.array(p0,float); p1=np.array(p1,float); v=p1-p0; L=np.linalg.norm(v)
    t=np.clip(((xx-p0[0])*v[0]+(yy-p0[1])*v[1])/L**2,0,1)
    return np.hypot(xx-(p0[0]+t*v[0]),yy-(p0[1]+t*v[1]))
# feathers + red cords on the left
F=poly([(0,150),(560,150),(560,830),(0,830)])*ss(560,250,xx)
# left robe hem + teal sashes
L=poly([(0,700),(520,700),(520,1340),(0,1340)])*ss(480,120,xx)*ss(720,1000,yy)
# right sleeve/robe drape
R=poly([(960,250),(1232,250),(1232,1400),(960,1400)])*ss(950,1140,xx)*ss(400,800,yy)
# hair strands
Hh=np.maximum(poly([(390,330),(520,330),(520,750),(390,750)])*ss(330,560,yy),poly([(830,300),(900,300),(900,560),(830,560)])*ss(330,520,yy))*0.55
rig=np.ones((H0,W0),np.float32)
rig*=ss(18,60,segdist((995,20),(330,1270)))     # katana blade + hilt
rig*=ss(18,55,segdist((975,540),(160,1300)))     # sheath (diagonal)
rig*=1-poly([(540,60),(1000,60),(1000,330),(540,330)])   # hat + raised hand
rig*=1-poly([(560,330),(900,330),(900,1632),(480,1632)]) # body/legs
rig=cv2.GaussianBlur(rig,(0,0),10)
def soft(m,s): return cv2.GaussianBlur(m,(0,0),s)
F=soft(F,16)*rig; L=soft(L,18)*rig; R=soft(R,18)*rig; Hh=soft(Hh,10)
np.savez(S+'sy/weights2x.npz',**{k:cv2.resize(v,(W,H),interpolation=cv2.INTER_LINEAR) for k,v in (('F',F),('L',L),('R',R),('H',Hh))})
viz=np.dstack([R+Hh,F,L]); Image.fromarray(((viz*0.85+a0[...,None]*0.35).clip(0,1)*255).astype(np.uint8)).resize((616,816)).save(S+'sy/weights_viz.png')
print('ok')
