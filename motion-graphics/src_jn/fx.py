# Anelia opening: flat-illustration hydrangea bloom + gothic magic circle (navy / teal)
import numpy as np, cv2, math
from lib import FW,FH,clamp,eio,eout,_yy,_xx
SH=4; SC=16
def ob(x,c1=1.70158):
    x=clamp(x); c3=c1+1; return 1+c3*(x-1)**3+c1*(x-1)**2
def mix(a,b,t): return tuple(float(a[i]+(b[i]-a[i])*t) for i in range(3))
def c8(c): return tuple(int(max(0,min(1,v))*255) for v in c)

class Canvas:
    """uint8 premultiplied RGB + alpha: AA drawing composites correctly"""
    def __init__(s): s.rgb=np.zeros((FH,FW,3),np.uint8); s.a=np.zeros((FH,FW),np.uint8)
    def poly(s,pts,col):
        p=(np.asarray(pts)*SC).astype(np.int32)
        cv2.fillPoly(s.rgb,[p],c8(col),cv2.LINE_AA,SH); cv2.fillPoly(s.a,[p],255,cv2.LINE_AA,SH)
    def lines(s,pts,col,th,closed=False):
        p=(np.asarray(pts)*SC).astype(np.int32)
        cv2.polylines(s.rgb,[p],closed,c8(col),th,cv2.LINE_AA,SH); cv2.polylines(s.a,[p],closed,255,th,cv2.LINE_AA,SH)
    def circle(s,c,r,col,th=-1):
        cc=(int(c[0]*SC),int(c[1]*SC)); rr=max(1,int(r*SC))
        cv2.circle(s.rgb,cc,rr,c8(col),th,cv2.LINE_AA,SH); cv2.circle(s.a,cc,rr,255,th,cv2.LINE_AA,SH)
    def comp(s,img,op=1.0,blur=0):
        rgb=s.rgb.astype(np.float32)/255; a=s.a.astype(np.float32)/255
        if blur: rgb=cv2.GaussianBlur(rgb,(0,0),blur); a=cv2.GaussianBlur(a,(0,0),blur)
        img[...]=rgb*op+img*(1-a[...,None]*op); return img

class LineLayer:
    def __init__(s): s.m=np.zeros((FH,FW),np.uint8)
    def line(s,a,b,th=1,v=255):
        cv2.line(s.m,(int(a[0]*SC),int(a[1]*SC)),(int(b[0]*SC),int(b[1]*SC)),v,th,cv2.LINE_AA,SH)
    def arc(s,c,r,a0,a1,th=1,v=255):
        if r<=0 or abs(a1-a0)<0.2: return
        cv2.ellipse(s.m,(int(c[0]*SC),int(c[1]*SC)),(int(r*SC),int(r*SC)),0,a0,a1,v,th,cv2.LINE_AA,SH)
    def poly(s,pts,th=1,closed=True,v=255):
        cv2.polylines(s.m,[(np.asarray(pts)*SC).astype(np.int32)],closed,v,th,cv2.LINE_AA,SH)
    def fill(s,pts,v=255): cv2.fillPoly(s.m,[(np.asarray(pts)*SC).astype(np.int32)],v,cv2.LINE_AA,SH)
    def f(s): return s.m.astype(np.float32)/255

class Cam:
    def __init__(s,cx,cy,z,rot): s.cx,s.cy,s.z,s.rot=cx,cy,z,rot; s.c,s.s=math.cos(rot),math.sin(rot)
    def P(s,pts):
        p=np.asarray(pts,np.float64)
        x=p[...,0]*s.c-p[...,1]*s.s; y=p[...,0]*s.s+p[...,1]*s.c
        return np.stack([s.cx+x*s.z,s.cy+y*s.z],-1)

def R2(a): c,s=math.cos(a),math.sin(a); return np.array([[c,-s],[s,c]])

# ---------------- palette ----------------
NAVY=(0.03,0.06,0.16); DEEP=(0.05,0.14,0.26); TEAL=(0.20,0.70,0.72); TEAL_L=(0.55,0.92,0.90); TEAL_D=(0.06,0.34,0.42)
PALE=(0.86,0.97,1.0)
BLUES=[(0.16,0.30,0.80),(0.24,0.43,0.92),(0.33,0.56,0.98),(0.20,0.60,0.88),(0.42,0.60,1.0),(0.17,0.50,0.82),(0.30,0.70,0.92)]

# ---------------- floret (4-petal hydrangea flower) ----------------
def _petal(L,W,n=14):
    u=np.linspace(0,1,n); w=W*np.sin(np.pi*u)**0.72*(1-0.28*u); x=L*(0.06+0.94*u)
    return np.vstack([np.stack([x,w],1),np.stack([x,-w],1)[::-1]])
PET=_petal(1.0,0.40); PET_HI=_petal(0.60,0.22); PET_VEIN=np.array([[0.12,0],[0.75,0]])
def floret(cv,cam,x,y,s,ang,col,open_=1.0,bright=1.0,outline=True):
    if s*cam.z<0.8: return
    col=tuple(min(1,c*bright) for c in col)
    hi=mix(col,PALE,0.50); edge=tuple(c*0.42 for c in col)
    Ls=s*(0.35+0.65*open_); Ws=s*(0.25+0.75*open_)
    for k in range(4):
        R=R2(ang+k*math.pi/2+(1-open_)*0.35)
        for shape,c in ((PET,col),(PET_HI,hi)):
            w=(shape*[Ls,Ws])@R.T+[x,y]
            cv.poly(cam.P(w),c)
        if outline:
            w=(PET*[Ls,Ws])@R.T+[x,y]
            cv.lines(cam.P(w),edge,1,True)
    cp=cam.P([[x,y]])[0]
    cv.circle(cp,s*0.17*cam.z,mix(PALE,col,0.25)); cv.circle(cp,s*0.07*cam.z,mix(col,(0.02,0.05,0.2),0.6))

class Cluster:
    def __init__(s,x,y,R,n,t0,seed,dome=1.0):
        rng=np.random.default_rng(seed); s.x,s.y,s.R,s.t0=x,y,R,t0; F=[]
        for i in range(n):
            r=R*0.93*math.sqrt((i+0.5)/n); th=i*2.39996+seed
            sz=R*0.26*(1-0.28*r/R)*rng.uniform(0.9,1.1)
            F.append(dict(dx=math.cos(th)*r,dy=math.sin(th)*r*0.92,s=sz,a=rng.uniform(0,math.pi/2),
                          c=BLUES[rng.integers(len(BLUES))],d=(r/R)*0.55+rng.uniform(0,0.12),
                          b=(0.78+0.30*(1-r/R))*dome,rr=r/R))
        s.F=sorted(F,key=lambda f:-f['rr'])
    def draw(s,cv,cam,t,burst=0.0,spin=0.0):
        for f in s.F:
            p=(t-s.t0-f['d'])/0.42
            if p<=0: continue
            e=ob(p); op=eout(p*1.15)
            x=s.x+f['dx']; y=s.y+f['dy']; a=f['a']+(1-e)*-0.9+spin
            if burst>0:
                L=math.hypot(f['dx'],f['dy'])+1e-3; ux,uy=f['dx']/L,f['dy']/L
                d=burst*s.R*(2.0+3.0*f['rr']+f['a']); x+=ux*d; y+=uy*d; a+=burst*3*(1 if f['a']>0.8 else -1)
            floret(cv,cam,x,y,f['s']*e*(1+burst*0.8),a,f['c'],op,f['b'])

# ---------------- leaves (two-tone flat) ----------------
def leaf_poly(L,W,bend):
    u=np.linspace(0,1,26); sp=np.stack([L*u,bend*L*np.sin(np.pi*u*0.9)],1)
    w=W*np.sin(np.pi*u)**0.85*(1-0.15*u)
    left=sp+np.stack([np.zeros_like(u),w],1); right=sp-np.stack([np.zeros_like(u),w],1)
    return np.vstack([left,sp[::-1]]),np.vstack([sp,right[::-1]]),sp
def leaf(cv,cam,x,y,L,W,ang,bend,p,dark=TEAL_D,light=TEAL):
    if p<=0: return
    e=ob(p,1.2); A,B,sp=leaf_poly(L*e,W*e,bend)
    R=R2(ang+(1-e)*0.6)
    for poly,c in ((A,dark),(B,light)): cv.poly(cam.P(poly@R.T+[x,y]),c)
    cv.lines(cam.P(sp[2:-3]@R.T+[x,y]),TEAL_L,1)
    for k in range(3,20,4):   # side veins
        q=sp[k]; d=np.array([L*e*0.10,W*e*0.55])
        cv.lines(cam.P(np.array([q,q+d*[1,1]])@R.T+[x,y]),mix(TEAL_L,light,0.5),1)

# ---------------- swirling leaf ribbons ----------------
class Ribbon:
    def __init__(s,r0,r1,th0,th1,w,cols,t0,dur,drift,wob=0.0,ph=0.0):
        s.__dict__.update(r0=r0*1.18,r1=r1*1.18,th0=th0,th1=th1,w=w*1.1,cols=cols,t0=t0,dur=dur,drift=drift,wob=wob,ph=ph)
    def draw(s,cv,cam,t):
        p=eout((t-s.t0)/s.dur,3)
        if p<=0.01: return
        n=60; u=np.linspace(0,1,n); th=s.th0+(s.th1-s.th0)*u*p+s.drift*t
        r=s.r0+(s.r1-s.r0)*u*p+s.wob*np.sin(u*p*np.pi*2.2+s.ph+t*0.8)
        c=np.stack([np.cos(th)*r,np.sin(th)*r],1)
        tg=np.gradient(c,axis=0); tg/=np.linalg.norm(tg,axis=1,keepdims=True)+1e-9; nr=np.stack([-tg[:,1],tg[:,0]],1)
        w=s.w*np.sin(np.pi*np.clip(u,0,1))**0.55*(0.6+0.4*p)
        outer=c+nr*w[:,None]; inner=c-nr*w[:,None]
        cv.poly(cam.P(np.vstack([outer,inner[::-1]])),s.cols[0])
        hi_in=c-nr*(w*0.15)[:,None]
        cv.poly(cam.P(np.vstack([outer,hi_in[::-1]])),s.cols[1])
        cv.lines(cam.P(c+nr*(w*0.55)[:,None]),s.cols[2],1)

# ---------------- magic circle (gothic tracery) ----------------
def magic_circle(ll,cam,R,p,rot,rot2):
    th=max(1,int(round(2*cam.z))); th1=max(1,int(round(1.2*cam.z)))
    C=cam.P([[0,0]])[0]; Rz=R*cam.z; d0=math.degrees(cam.rot)
    def seg(a,b,f):
        if f<=0: return
        A=np.array(a); B=np.array(b); ll.line(cam.P([A])[0],cam.P([A+(B-A)*clamp(f)])[0],th1)
    pr=clamp(p/0.35)
    ll.arc(C,Rz,d0-90,d0-90+360*pr,th); ll.arc(C,Rz*0.93,d0+90,d0+90-360*pr,th1)
    ll.arc(C,Rz*0.38,d0,d0+360*clamp((p-0.55)/0.3),th1)
    # outer dashed ring
    pd=clamp((p-0.15)/0.4)
    for i in range(int(48*pd)):
        a=i*7.5+math.degrees(rot2); ll.arc(C,Rz*1.17,a,a+4.2,th1)
    # octagram
    po=clamp((p-0.25)/0.35)
    V=[[math.cos(math.radians(45*k-90)+rot)*R*0.93,math.sin(math.radians(45*k-90)+rot)*R*0.93] for k in range(8)]
    for sq in (0,1):
        for j in range(4):
            a=V[(sq+2*j)%8]; b=V[(sq+2*j+2)%8]; seg(a,b,po*4-j)
    # rosette of 8 circles
    prs=clamp((p-0.45)/0.35)
    for k in range(8):
        a=math.radians(22.5+45*k)+rot; c=cam.P([[math.cos(a)*R*0.62,math.sin(a)*R*0.62]])[0]
        ll.arc(c,R*0.25*cam.z,math.degrees(a)+180+d0,math.degrees(a)+180+d0+360*prs,th1)
    # runes between rings
    pu=clamp((p-0.6)/0.4)
    for i in range(int(36*pu)):
        a=math.radians(i*10)+rot*-0.5; ca,sa=math.cos(a),math.sin(a)
        r0,r1=R*1.02,R*1.12; m=i%4
        P0=cam.P([[ca*r0,sa*r0]])[0]; P1=cam.P([[ca*r1,sa*r1]])[0]; Pm=(P0+P1)/2
        if m==0: ll.line(P0,P1,th1)
        elif m==1: ll.arc(Pm,R*0.025*cam.z,0,360,th1)
        elif m==2:
            d=R*0.03*cam.z; ll.poly([Pm+[0,-d],Pm+[d,0],Pm+[0,d],Pm+[-d,0]],th1)
        else:
            t2=np.array([-sa,ca])*R*0.012*cam.z; ll.line(P0+t2,P1+t2,th1); ll.line(P0-t2,P1-t2,th1)
    # floret glyph in centre
    pg=clamp((p-0.7)/0.3)
    if pg>0:
        for k in range(4):
            Rr=R2(rot*2+k*math.pi/2); w=(PET*[R*0.30*pg,R*0.30*0.9*pg])@Rr.T
            ll.poly(cam.P(w),th1)

# ---------------- sparkles / petals / light ribbon ----------------
def star4(cv,c,L,col):
    w=L*0.22; pts=[(0,-L),(w,-w),(L,0),(w,w),(0,L),(-w,w),(-L,0),(-w,-w)]
    cv.poly(np.array(pts)+c,col)
rng=np.random.default_rng(21)
SPK=[dict(x=rng.uniform(40,FW-40),y=rng.uniform(60,FH-60),L=rng.uniform(5,17),ph=rng.uniform(0,6.3),
          sp=rng.uniform(1.5,3.2),c=[(1,0.9,0.62),PALE,TEAL_L][rng.integers(3)]) for _ in range(46)]
STORM=[dict(a=rng.uniform(0,6.283),r=rng.uniform(120,560),w=rng.uniform(0.5,1.4)*(1 if rng.random()<0.7 else -1),
            s=rng.uniform(9,22),c=BLUES[rng.integers(len(BLUES))],t0=rng.uniform(1.8,2.6),z=rng.uniform(0.7,1.6),
            spin=rng.uniform(-3,3)) for _ in range(80)]
def bezier(P,u):
    P=np.asarray(P,float); u=np.asarray(u)[:,None]
    return (1-u)**3*P[0]+3*(1-u)**2*u*P[1]+3*(1-u)*u**2*P[2]+u**3*P[3]
LIGHT=[(-160,1580),(260,1180),(820,820),(1260,260)]

# ---------------- scene ----------------
CL_MAIN=Cluster(0,0,215,84,0.55,1)
CL_SIDE=[Cluster(-380,-500,130,46,0.95,2),Cluster(400,-430,112,40,1.05,3),Cluster(-410,470,140,52,1.12,4),Cluster(380,540,150,58,1.2,5)]
LEAVES_MAIN=[(-70,110,300,84,math.radians(140),0.18,0.45),(80,115,280,78,math.radians(40),-0.18,0.52),
             (-35,-75,230,62,math.radians(235),0.15,0.62),(45,-85,220,60,math.radians(-50),-0.15,0.66)]
LEAVES_SIDE=[(-380,-500,200,54,math.radians(200),0.2,0.9),(400,-430,185,50,math.radians(-20),-0.2,1.0),
             (-410,470,215,58,math.radians(160),0.2,1.05),(380,540,225,60,math.radians(20),-0.2,1.12),
             (-350,-450,170,46,math.radians(110),-0.2,0.95),(430,500,190,52,math.radians(80),0.2,1.15),
             (-440,420,160,44,math.radians(250),-0.2,1.1),(340,-380,150,42,math.radians(-110),0.2,1.02)]
RIBBONS=[Ribbon(470,430,math.radians(200),math.radians(380),46,(TEAL_D,TEAL,TEAL_L),0.0,1.3,0.10,40,0.0),
         Ribbon(520,560,math.radians(20),math.radians(200),40,((0.08,0.40,0.55),(0.25,0.62,0.78),PALE),0.15,1.3,0.08,55,1.2),
         Ribbon(600,520,math.radians(100),math.radians(260),58,((0.05,0.22,0.40),(0.12,0.40,0.60),(0.4,0.7,0.85)),0.25,1.4,-0.06,35,2.1),
         Ribbon(420,470,math.radians(-60),math.radians(120),30,((0.10,0.52,0.56),(0.35,0.82,0.80),PALE),0.4,1.2,0.12,60,0.6),
         Ribbon(650,700,math.radians(250),math.radians(420),70,((0.04,0.16,0.32),(0.08,0.30,0.48),(0.3,0.6,0.8)),0.1,1.5,0.05,30,3.0),
         Ribbon(560,600,math.radians(140),math.radians(330),34,((0.12,0.58,0.62),(0.45,0.88,0.86),PALE),0.55,1.1,-0.09,70,4.0)]

def background(cx,cy,t):
    r=np.hypot((_xx-cx)/FW,(_yy-cy)/FH)
    g=np.clip(1-r*1.35,0,1)[...,None]
    img=np.array(NAVY,np.float32)+(np.array(DEEP,np.float32)-np.array(NAVY,np.float32))*g+np.array([0.02,0.10,0.10],np.float32)*g**3
    # big soft bokeh discs
    lay=np.zeros((FH,FW,3),np.float32)
    for i,(x,y,rr,c) in enumerate([(160,300,260,TEAL),(930,1500,320,(0.2,0.35,0.9)),(900,380,200,(0.2,0.5,0.8)),(140,1600,240,TEAL)]):
        cv2.circle(lay,(int(x+40*math.sin(t*0.4+i)),int(y+30*math.cos(t*0.33+i))),rr,c,-1)
    img+=cv2.GaussianBlur(lay,(0,0),90)*0.18
    return img.astype(np.float32)

def opening(t,T_dive,T_cut):
    if t<2.2: z=0.74+0.16*eio(t/2.2)
    elif t<T_dive: z=0.90+0.50*eio((t-2.2)/(T_dive-2.2))
    else: z=1.40*math.exp(2.9*(t-T_dive)/(T_cut-T_dive))
    rot=0.05*t
    cx,cy=FW/2,FH*0.47
    cam=Cam(cx,cy,z,rot)
    img=background(cx,cy,t)
    burst=eio((t-T_dive)/(T_cut-T_dive)) if t>T_dive else 0.0
    # magic circle (behind)
    ll=LineLayer(); mp=clamp((t-1.05)/1.35)
    if mp>0:
        magic_circle(ll,cam,385,mp,rot*0.6,-rot*1.4)
        m=ll.f(); col=np.array(PALE,np.float32)*0.85+np.array(TEAL_L,np.float32)*0.15
        pulse=1+1.2*math.exp(-((t-2.45)/0.12)**2)+2.0*burst
        img+=cv2.GaussianBlur(m,(0,0),max(4,6*z))[...,None]*np.array(TEAL,np.float32)*1.6*pulse
        img+=cv2.GaussianBlur(m,(0,0),1.5)[...,None]*col*0.5+m[...,None]*col*0.9
    # ribbons + flowers (opaque illustration layer)
    cv=Canvas()
    for rb in RIBBONS: rb.draw(cv,Cam(cx,cy,z**1.15,rot*0.4),t)
    for (x,y,L,W,a,b,t0) in LEAVES_SIDE: leaf(cv,cam,x,y,L,W,a,b,(t-t0)/0.5)
    for cl in CL_SIDE: cl.draw(cv,cam,t,burst*0.6)
    if burst<0.95:
        for (x,y,L,W,a,b,t0) in LEAVES_MAIN: leaf(cv,cam,x*(1+burst*3),y*(1+burst*3),L,W,a,b,(t-t0)/0.5)
    CL_MAIN.draw(cv,cam,t,burst,spin=0.0)
    # petal storm
    for f in STORM:
        u=t-f['t0']
        if u<=0: continue
        e=ob(u/0.4); a=f['a']+f['w']*u*0.9; r=f['r']*(1+0.25*u+burst*2.5)
        x,y=math.cos(a)*r,math.sin(a)*r
        floret(cv,Cam(cx,cy,z**f['z'],rot),x,y,f['s']*e,f['spin']*u,f['c'],1.0,1.0,outline=False)
    # soft shadow under illustration for depth
    sh=cv2.GaussianBlur(cv.a.astype(np.float32)/255,(0,0),14)
    img*=1-0.45*sh[...,None]
    cv.comp(img)
    # sparkles + light ribbon (additive)
    add=Canvas()
    for s_ in SPK:
        k=max(0,math.sin(t*s_['sp']+s_['ph']))**3*clamp(t/0.5)
        if k>0.02: star4(add,np.array([s_['x'],s_['y']]),s_['L']*(0.6+0.4*k),tuple(c*k for c in s_['c']))
    lr=(t-1.85)/1.0
    if 0<lr<1.25:
        u=np.linspace(max(0,lr-0.35),min(1,lr),50)
        if len(u)>1:
            pts=bezier(LIGHT,u); w=np.sin(np.pi*np.linspace(0,1,len(u)))*14
            for i in range(len(pts)-1):
                add.lines(pts[i:i+2],PALE,max(1,int(w[i])))
    la=add.rgb.astype(np.float32)/255
    img+=la+cv2.GaussianBlur(la,(0,0),6)*1.5+cv2.GaussianBlur(la,(0,0),22)*1.2
    # shockwave when circle completes
    sw=t-2.45
    if 0<sw<0.8:
        ring=LineLayer(); C=cam.P([[0,0]])[0]; ring.arc(C,385*z*(1+1.3*eout(sw/0.8)),0,360,max(1,int(5*(1-sw))))
        img+=cv2.GaussianBlur(ring.f(),(0,0),3)[...,None]*np.array(TEAL_L,np.float32)*(1-sw/0.8)*1.5
    # portal glow during dive
    if t>T_dive-0.3:
        k=clamp((t-(T_dive-0.3))/(T_cut-T_dive+0.3))
        C=cam.P([[0,0]])[0]; d=np.hypot(_xx-C[0],_yy-C[1])
        img+=(np.exp(-d/(120+900*k**2))*(0.6+2.5*k))[...,None]*np.array(TEAL_L,np.float32)
    # foreground blurred florets (depth)
    if t>0.6:
        fg=Canvas(); zf=z**1.8
        for (x,y,s_,c) in ((-470,-760,70,BLUES[2]),(480,820,80,BLUES[4]),(-520,700,55,BLUES[6]),(520,-700,60,BLUES[1])):
            floret(fg,Cam(cx,cy,zf,rot*1.5),x,y,s_*ob((t-0.6)/0.6),t*0.4,c,1.0,1.0,False)
        fg.comp(img,0.85,blur=12)
    vig=np.clip(1-(np.hypot((_xx-FW/2)/FW,(_yy-FH/2)/FH)**2)*1.1,0.35,1)[...,None]
    img*=vig
    img+=(clamp((t-(T_cut-0.22))/0.22)**2*1.5)*np.array([0.82,0.97,1.0],np.float32)
    return img
