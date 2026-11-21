import numpy as np, cv2, math
import os
S=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')+'/'
FW,FH,FPS=1080,1920,30
SPR=np.load(S+'rm/sprite2x.npy')            # H,W,4 uint8 straight alpha
SH,SW=SPR.shape[:2]
_w=np.load(S+'rm/weights2x.npz'); WL,WR,WTIE=[_w[k] for k in ('L','R','tie')]
GX,GY=np.meshgrid(np.arange(SW,dtype=np.float32),np.arange(SH,dtype=np.float32))
YN=GY/SH
_pm=SPR.astype(np.float32)/255; _pm[...,:3]*=_pm[...,3:4]; SPR_PM=_pm   # premultiplied float

def clamp(v,a=0.,b=1.): return max(a,min(b,v))
def ease(t): t=clamp(t); return t*t*(3-2*t)
def eio(t,p=3):
    t=clamp(t); return 4*t*t*t if t<.5 else 1-(-2*t+2)**3/2
def eout(t,p=3): t=clamp(t); return 1-(1-t)**p

BPM=120.0; BEAT=60.0/BPM
def beat_env(t,decay=7.0):
    ph=(t%BEAT); return math.exp(-ph*decay)
def displacement(t, amp=1.0):
    w=2*math.pi*0.5
    k=2*math.pi*YN*2.0; kx=2*math.pi*(GX/SW)*1.5
    b=beat_env(t)
    sL=0.70*np.sin(w*t+kx)+0.30*np.sin(2*w*t+1.3*kx+0.5)
    sR=0.70*np.sin(w*t-k-0.6)+0.30*np.sin(2*w*t-1.4*k+1.9)
    A=26*amp
    dx=A*(WL*sL+WR*sR)
    dy=A*(WL*0.6*np.cos(w*t+kx)+WR*0.3*np.cos(w*t-k-0.6))
    dx+=14*amp*WTIE*np.sin(2*math.pi*0.9*t-GX/SW*10)
    dy+=8*amp*WTIE*np.cos(2*math.pi*1.1*t-GX/SW*8)
    return dx,dy

def char_frame(t, amp=1.0):
    dx,dy=displacement(t,amp)
    return cv2.remap(SPR_PM,GX-dx,GY-dy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=0)

def place(layer_pm, cx, cy, scale, rot=0.0, sx=None, sy=None, out=(FW,FH)):
    """Map layer so that source point (sx,sy) [default centre] lands at frame (cx,cy)."""
    h,w=layer_pm.shape[:2]; sx=w/2 if sx is None else sx; sy=h/2 if sy is None else sy
    M=cv2.getRotationMatrix2D((sx,sy),rot,scale); M[0,2]+=cx-sx; M[1,2]+=cy-sy
    return cv2.warpAffine(layer_pm,M,out,flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=0)

def over(dst, src_pm, opacity=1.0):
    a=src_pm[...,3:4]*opacity
    dst[...,:3]=src_pm[...,:3]*opacity+dst[...,:3]*(1-a)
    return dst

def add(dst, rgb, k=1.0): dst[...,:3]+=rgb[...,:3]*k; return dst

def glow(pm, sigma, k):
    g=cv2.GaussianBlur(pm[...,:3],(0,0),sigma); return g*k

# ---------- background & particles ----------
_yy,_xx=np.mgrid[0:FH,0:FW].astype(np.float32)
def bg_navy(t, lift=0.0):
    r=np.hypot((_xx-FW/2)/FW,(_yy-FH*0.42)/FH)
    top=np.array([0.035,0.05,0.12]); mid=np.array([0.07,0.11,0.26])
    g=np.clip(1-r*1.6,0,1)[...,None]
    c=top+(mid-top)*g*(0.8+0.2*lift)
    vign=np.clip(1-(r**2)*1.1,0.25,1)[...,None]
    img=np.zeros((FH,FW,4),np.float32); img[...,:3]=c*vign; img[...,3]=1
    return img

rng=np.random.default_rng(7)
NP=170
P=dict(x=rng.uniform(0,FW,NP),y=rng.uniform(0,FH,NP),vy=rng.uniform(-38,-12,NP),vx=rng.uniform(-6,10,NP),
       r=rng.uniform(1.0,3.2,NP),ph=rng.uniform(0,6.28,NP),gold=rng.random(NP)<0.45,z=rng.uniform(0.6,1.6,NP))
def particles(t, k=1.0, drift=(0,0)):
    lay=np.zeros((FH,FW,3),np.float32)
    for i in range(NP):
        x=(P['x'][i]+P['vx'][i]*t*P['z'][i]+drift[0]*P['z'][i])%FW
        y=(P['y'][i]+P['vy'][i]*t*P['z'][i]+drift[1]*P['z'][i])%FH
        tw=0.55+0.45*math.sin(t*2.3+P['ph'][i])
        col=(1.0,0.25,0.75) if P['gold'][i] else (0.30,1.0,0.65)
        cv2.circle(lay,(int(x),int(y)),max(1,int(P['r'][i]*P['z'][i])),tuple(c*tw*k for c in col),-1,cv2.LINE_AA)
    return lay+cv2.GaussianBlur(lay,(0,0),6)*2.2

def sparkle(lay, x, y, size, k, col=(1,1,1), rot=0):
    """four-point star glint"""
    s=int(size)
    for ang,l in ((rot,1.0),(rot+90,1.0),(rot+45,0.45),(rot+135,0.45)):
        a=math.radians(ang); dx,dy=math.cos(a)*s*l,math.sin(a)*s*l
        cv2.line(lay,(int(x-dx),int(y-dy)),(int(x+dx),int(y+dy)),tuple(c*k for c in col),2,cv2.LINE_AA)
    cv2.circle(lay,(int(x),int(y)),max(2,s//8),tuple(c*k*1.5 for c in col),-1,cv2.LINE_AA)
    return lay

def to8(img): return (np.clip(img[...,:3],0,1)*255+0.5).astype(np.uint8)
