# Procedural snowflake opening (all vector, drawn per frame at output resolution)
import numpy as np, cv2, math
from lib import FW,FH,clamp,ease,eio,eout
from lib import _yy,_xx
SH4=4; SC=1<<SH4
ICE=np.array([0.72,0.86,1.0],np.float32); WHITE=np.array([0.95,0.98,1.0],np.float32)
FROST=np.array([0.62,0.72,0.88],np.float32)

def rot2(x,y,a): c,s=math.cos(a),math.sin(a); return x*c-y*s, x*s+y*c

# ---------- snowflake geometry (unit radius) ----------
def _seg(x0,y0,x1,y1,w0,w1): return (x0,y0,x1,y1,w0,w1)
def flake_geom(variant=0):
    segs=[]; polys=[]
    for k in range(6):
        a=math.radians(k*60-90)
        def P(r,da=0.0,off=(0,0)):
            x,y=rot2(r,0,a+da); return x+off[0],y+off[1]
        # main arm
        segs.append((*P(0.10),*P(1.0),0.050,0.012))
        # side branches
        brs=[(0.30,0.32,0.034),(0.52,0.25,0.028),(0.72,0.16,0.020)] if variant==0 else [(0.40,0.36,0.030),(0.68,0.20,0.020)]
        for d,L,w in brs:
            bx,by=P(d)
            for sgn in (-1,1):
                ex,ey=rot2(L,0,a+sgn*math.radians(60)); segs.append((bx,by,bx+ex,by+ey,w,0.006))
                # barbs on the first branch
                if d==brs[0][0]:
                    mx,my=bx+ex*0.55,by+ey*0.55
                    for s2 in (-1,1):
                        fx,fy=rot2(L*0.28,0,a+sgn*math.radians(60)+s2*math.radians(60)*-sgn*0+ (math.radians(60) if s2>0 else -math.radians(0))*0)
                        bx2,by2=rot2(L*0.26,0,a); segs.append((mx,my,mx+bx2,my+by2,0.012,0.004))
        # tip crystal (diamond)
        tx,ty=P(1.0); polys.append([P(0.94),P(1.02,math.radians(4.5)),P(1.12),P(1.02,-math.radians(4.5))])
        # secondary short arm
        a2=a+math.radians(30)
        sx0,sy0=rot2(0.13,0,a2); sx1,sy1=rot2(0.40,0,a2); segs.append((sx0,sy0,sx1,sy1,0.026,0.005))
        dx,dy=rot2(0.33,0,a2); polys.append([rot2(0.30,0,a2),rot2(0.335,0,a2+0.07),rot2(0.37,0,a2),rot2(0.335,0,a2-0.07)])
    hexo=[rot2(0.17,0,math.radians(k*60-90)) for k in range(6)]
    hexi=[rot2(0.09,0,math.radians(k*60-60)) for k in range(6)]
    return segs,polys,hexo,hexi
GEOM={0:flake_geom(0),1:flake_geom(1)}

def _xf(cam,x,y):
    cx,cy,s,rot=cam; xr,yr=rot2(x,y,rot); return cx+xr*s, cy+yr*s

def draw_flake(cam, prog=1.0, variant=0, fill=None, line=None):
    """cam=(cx,cy,radius_px,rotation). prog: radial growth 0..1.15. Draws into fill / line float masks."""
    segs,polys,hexo,hexi=GEOM[variant]
    R=cam[2]
    def ip(pts): return np.array([[int(px*SC),int(py*SC)] for px,py in pts],np.int32)
    for (x0,y0,x1,y1,w0,w1) in segs:
        r0,r1=math.hypot(x0,y0),math.hypot(x1,y1)
        f=1.0 if r1<=prog else clamp((prog-r0)/max(r1-r0,1e-3))
        if f<=0: continue
        x1f,y1f=x0+(x1-x0)*f,y0+(y1-y0)*f; w1f=w0+(w1-w0)*f
        L=math.hypot(x1-x0,y1-y0)+1e-6; nx,ny=-(y1-y0)/L,(x1-x0)/L
        quad=[(x0+nx*w0,y0+ny*w0),(x1f+nx*w1f,y1f+ny*w1f),(x1f-nx*w1f,y1f-ny*w1f),(x0-nx*w0,y0-ny*w0)]
        pts=ip([_xf(cam,*p) for p in quad])
        cv2.fillPoly(fill,[pts],1.0,cv2.LINE_AA,SH4)
        a=_xf(cam,x0,y0); b=_xf(cam,x1f,y1f)
        cv2.line(line,(int(a[0]*SC),int(a[1]*SC)),(int(b[0]*SC),int(b[1]*SC)),1.0,max(1,int(R*0.006)),cv2.LINE_AA,SH4)
    for poly in polys:
        rr=max(math.hypot(*p) for p in poly)
        if rr<=prog+0.05:
            pts=ip([_xf(cam,*p) for p in poly]); cv2.fillPoly(fill,[pts],1.0,cv2.LINE_AA,SH4)
    if prog>0.02:
        k=clamp(prog/0.2)
        ho=ip([_xf(cam,x*k,y*k) for x,y in hexo]); hi=ip([_xf(cam,x*k,y*k) for x,y in hexi])
        cv2.polylines(line,[ho],True,1.0,max(1,int(R*0.008)),cv2.LINE_AA,SH4)
        cv2.fillPoly(fill,[hi],1.0,cv2.LINE_AA,SH4)
        cv2.polylines(line,[hi],True,1.0,max(1,int(R*0.006)),cv2.LINE_AA,SH4)

def shade_flake(fill,line,cam,k=1.0,sweep=None):
    """turn masks into premultiplied-ish RGB light"""
    edge=np.clip(fill-cv2.erode(fill,np.ones((3,3),np.uint8)),0,1)
    r=np.hypot(_xx-cam[0],_yy-cam[1])/max(cam[2],1)
    body=(0.30+0.25*np.clip(1-r,0,1))[...,None]*ICE*fill[...,None]
    rgb=body+edge[...,None]*WHITE*0.9+line[...,None]*WHITE*0.8
    if sweep is not None:
        band=np.exp(-(((_xx*0.6+_yy*0.8)/FH)-sweep)**2/0.004)
        rgb=rgb+(band*np.maximum(fill,line))[...,None]*np.array([0.9,0.95,1.0])
    return rgb*k

# ---------- frost vines with ice thorns ----------
def _catmull(pts,n=24):
    P=np.array(pts,float); out=[]
    P=np.vstack([P[0],P,P[-1]])
    for i in range(1,len(P)-2):
        p0,p1,p2,p3=P[i-1],P[i],P[i+1],P[i+2]
        for t in np.linspace(0,1,n,endpoint=False):
            t2,t3=t*t,t*t*t
            out.append(0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3))
    out.append(P[-2]); return np.array(out)
VINES=[_catmull([(-2.3,3.6),(-1.9,2.3),(-1.25,1.45),(-1.62,0.35),(-1.25,-0.85),(-0.35,-1.55),(0.75,-1.5),(1.45,-0.75),(1.55,0.15)]),
       _catmull([(2.4,3.3),(1.75,2.25),(1.05,1.75),(0.2,1.85),(-0.55,1.45),(-0.6,0.95)])]
def draw_vines(cam,prog,lay,k=1.0):
    col=tuple(float(c*k*0.7) for c in FROST)
    for vi,V in enumerate(VINES):
        p=clamp(prog-vi*0.12)
        n=int(len(V)*eout(p,2))
        if n<2: continue
        R=cam[2]
        for i in range(n-1):
            u=i/len(V); w=max(1,int(R*(0.030*(1-u)+0.008)))
            a=_xf(cam,*V[i]); b=_xf(cam,*V[i+1])
            cv2.line(lay,(int(a[0]*SC),int(a[1]*SC)),(int(b[0]*SC),int(b[1]*SC)),col,w,cv2.LINE_AA,SH4)
            if i%9==4:  # ice thorn
                d=V[i+1]-V[i]; d/=np.linalg.norm(d)+1e-9; nrm=np.array([-d[1],d[0]])*(1 if (i//9)%2 else -1)
                L=0.11*(1-u*0.6)
                base1=V[i]-d*0.03; base2=V[i]+d*0.03; tip=V[i]+nrm*L+d*0.05
                pts=np.array([[int(c*SC) for c in _xf(cam,*q)] for q in (base1,tip,base2)],np.int32)
                cv2.fillPoly(lay,[pts],col,cv2.LINE_AA,SH4)

# ---------- converging vines -> arms ----------
NU=140; UU=np.linspace(0,1,NU)
def conv_vine_pts(i,m,spin_t):
    """vine i as points (unit coords, flake frame). u=0 head at centre. m: 0 spiral -> 1 straight arm"""
    a=math.radians(i*60-90)
    rmax=6.0*(1-m)+1.0*m
    r=UU*rmax
    th=a+(2.6+0.25*math.sin(spin_t+i))*(UU**1.15)*(1-m)*(1 if i%2==0 else 1)
    return np.stack([np.cos(th)*r,np.sin(th)*r],1)
def draw_conv_vines(cam,t,lay,k=1.0):
    """entry 0.1-0.95s, morph 0.85-1.4s, fade 1.25-1.6s"""
    if t<0.1 or t>1.75: return []
    fade=1-clamp((t-1.38)/0.35)
    m=eio((t-0.80)/0.75)
    heads=[]
    R=cam[2]
    for i in range(6):
        h=1-eout((t-0.1-i*0.04)/0.85,2)          # head position along u (1 = off-screen, 0 = centre)
        V=conv_vine_pts(i,m,t*1.5)
        u0=h; u1=min(1.0,h+0.75+m)
        idx=np.where((UU>=u0)&(UU<=u1))[0]
        if len(idx)<2: continue
        col=tuple(float(c*k*fade) for c in (FROST*0.55+ICE*0.45))
        for j in range(len(idx)-1):
            q=idx[j]; uu=(UU[q]-u0)/max(u1-u0,1e-3)
            w=max(1,int(R*(0.012+0.030*(1-m)*(1-uu)+0.035*m*(1-UU[q]))))
            a_=_xf(cam,*V[q]); b_=_xf(cam,*V[q+1])
            cv2.line(lay,(int(a_[0]*SC),int(a_[1]*SC)),(int(b_[0]*SC),int(b_[1]*SC)),col,w,cv2.LINE_AA,SH4)
            if q%8==3 and m<0.95:
                d=V[q+1]-V[q]; d/=np.linalg.norm(d)+1e-9; nrm=np.array([-d[1],d[0]])*(1 if (q//8)%2 else -1)
                L=0.16*(1-m)*(0.4+UU[q])
                tri=(V[q]-d*0.04,V[q]+nrm*L+d*0.06,V[q]+d*0.04)
                pts=np.array([[int(c*SC) for c in _xf(cam,*pp)] for pp in tri],np.int32)
                cv2.fillPoly(lay,[pts],col,cv2.LINE_AA,SH4)
        if h>0.01: heads.append(_xf(cam,*V[idx[0]]))
    return heads

# ---------- magic ring ----------
def draw_ring(cam,prog,lay,k=1.0):
    if prog<=0: return
    cx,cy,R,rot=cam; col=tuple(float(c*k) for c in ICE)
    for rr,th,dirn in ((1.42,2,1),(1.52,1,-1)):
        ang=math.degrees(rot)*dirn
        cv2.ellipse(lay,(int(cx*SC),int(cy*SC)),(int(R*rr*SC),int(R*rr*SC)),ang,-90,-90+360*prog,col,th,cv2.LINE_AA,SH4)
    ntk=72
    for i in range(int(ntk*prog)):
        a=math.radians(i*360/ntk)+rot*0.5
        r0=1.42; r1=1.47 if i%6 else 1.55
        x0,y0=cx+math.cos(a)*R*r0,cy+math.sin(a)*R*r0; x1,y1=cx+math.cos(a)*R*r1,cy+math.sin(a)*R*r1
        cv2.line(lay,(int(x0*SC),int(y0*SC)),(int(x1*SC),int(y1*SC)),col,1,cv2.LINE_AA,SH4)
        if i%12==0:
            mx,my=cx+math.cos(a)*R*1.62,cy+math.sin(a)*R*1.62; d=R*0.035
            pts=np.array([(mx+math.cos(a)*d*1.6,my+math.sin(a)*d*1.6),(mx-math.sin(a)*d,my+math.cos(a)*d),
                          (mx-math.cos(a)*d*1.6,my-math.sin(a)*d*1.6),(mx+math.sin(a)*d,my-math.cos(a)*d)])
            cv2.fillPoly(lay,[(pts*SC).astype(np.int32)],col,cv2.LINE_AA,SH4)

# ---------- ice pillars (background, parallax) ----------
PIL=[(-0.46,0.10,0.38),(-0.33,0.07,0.55),(-0.20,0.05,0.30),(0.21,0.05,0.34),(0.34,0.075,0.58),(0.47,0.10,0.42),(-0.05,0.04,0.66),(0.07,0.035,0.70)]
def draw_pillars(z,lay,k=1.0):
    zz=z**0.45
    for (px,pw,top) in PIL:
        x=FW/2+px*FW*1.9*zz; w=pw*FW*zz; ytop=FH*(top+0.0)-(zz-1)*FH*0.3
        ybot=FH*1.2
        pts=np.array([(x-w/2,ybot),(x-w/2,ytop+w*0.9),(x,ytop),(x+w/2,ytop+w*0.9),(x+w/2,ybot)],np.float32)
        m=np.zeros((FH,FW),np.float32); cv2.fillPoly(m,[(pts*SC).astype(np.int32)],1.0,cv2.LINE_AA,SH4)
        grad=np.clip((_yy-ytop)/(FH*0.9),0,1)
        facet=np.where(_xx<x,0.55,0.85)
        lay+= (m*(0.10+0.10*grad)*facet)[...,None]*np.array([0.35,0.5,0.85])*k
        cv2.polylines(lay,[(pts*SC).astype(np.int32)],False,tuple(float(c*0.25*k) for c in ICE),1,cv2.LINE_AA,SH4)
        cv2.line(lay,(int(x*SC),int(ytop*SC)),(int(x*SC),int(ybot*SC)),tuple(float(c*0.12*k) for c in ICE),1,cv2.LINE_AA,SH4)

# ---------- snowfall ----------
rng=np.random.default_rng(11); NS=140
SNOW=dict(x=rng.uniform(0,FW,NS),y=rng.uniform(0,FH,NS),v=rng.uniform(40,120,NS),sway=rng.uniform(10,40,NS),
          ph=rng.uniform(0,6.28,NS),s=rng.uniform(1.5,4.5,NS),z=rng.uniform(0.5,2.2,NS))
def snowfall(t,lay,zoom=1.0,k=1.0):
    for i in range(NS):
        z=SNOW['z'][i]; zf=zoom**(0.3*z)
        x=(SNOW['x'][i]-FW/2)*zf+FW/2+math.sin(t*1.3+SNOW['ph'][i])*SNOW['sway'][i]
        y=((SNOW['y'][i]+SNOW['v'][i]*z*t)%(FH+60))-30
        y=(y-FH/2)*zf+FH/2
        r=SNOW['s'][i]*z*zf**0.5
        if not(-20<x<FW+20 and -20<y<FH+20): continue
        c=tuple(float(v*k*min(1,0.35+0.3*z)) for v in WHITE)
        if r>5:   # tiny six-point flake glyph
            for j in range(3):
                a=math.radians(j*60+t*20+SNOW['ph'][i]*30); dx,dy=math.cos(a)*r,math.sin(a)*r
                cv2.line(lay,(int((x-dx)*SC),int((y-dy)*SC)),(int((x+dx)*SC),int((y+dy)*SC)),c,1,cv2.LINE_AA,SH4)
        else:
            cv2.circle(lay,(int(x*SC),int(y*SC)),int(r*SC),c,-1,cv2.LINE_AA,SH4)

# ---------- shard burst ----------
NB=46; BR=np.random.default_rng(5)
BURST=dict(a=BR.uniform(0,2*math.pi,NB),v=BR.uniform(0.8,2.6,NB),L=BR.uniform(0.05,0.16,NB),spin=BR.uniform(-4,4,NB),w=BR.uniform(0.012,0.03,NB))
def shards(cam,age,lay,k=1.0,streak=1.0):
    if age<0 or age>1.4: return
    cx,cy,R,_=cam; fade=(1-age/1.4)**1.5*k
    for i in range(NB):
        d=0.2+BURST['v'][i]*eout(age/1.4,2)*1.6
        a=BURST['a'][i]; x,y=cx+math.cos(a)*d*R,cy+math.sin(a)*d*R
        L=BURST['L'][i]*R*(1+streak*2*(1-age)); w=BURST['w'][i]*R
        sa=a+BURST['spin'][i]*age*0.3
        p=[(x+math.cos(sa)*L,y+math.sin(sa)*L),(x-math.sin(sa)*w,y+math.cos(sa)*w),(x-math.cos(sa)*L*0.4,y-math.sin(sa)*L*0.4),(x+math.sin(sa)*w,y-math.cos(sa)*w)]
        cv2.fillPoly(lay,[(np.array(p)*SC).astype(np.int32)],tuple(float(c*fade) for c in WHITE),cv2.LINE_AA,SH4)

def shockwave(cam,age,lay,k=1.0):
    if age<0 or age>0.9: return
    cx,cy,R,_=cam; r=R*(0.3+2.6*eout(age/0.9,3)); f=(1-age/0.9)**2*k
    cv2.circle(lay,(int(cx*SC),int(cy*SC)),int(r*SC),tuple(float(c*f) for c in ICE),max(1,int(6*(1-age))),cv2.LINE_AA,SH4)

# ---------- full opening frame ----------
TB=1.82   # flake completes / burst
def opening(t, T_dive, T_cut):
    """returns float RGB frame (FH,FW,3)"""
    # camera zoom
    if t<1.6: z=1.0+0.30*eio(t/1.6)
    elif t<T_dive: z=1.30+3.4*eio((t-1.6)/(T_dive-1.6))
    else: z=4.70*math.exp(3.2*(t-T_dive)/(T_cut-T_dive))
    base_R=200; cyw=FH*0.43
    cx=FW/2; cy=cyw+(FH*0.47-cyw)*clamp((z-1)/3.7)
    rot=math.radians(-8+9*max(0,t-1.0))
    R=base_R*z
    img=np.zeros((FH,FW,3),np.float32)
    # background gradient
    r=np.hypot((_xx-cx)/FW,(_yy-cy)/FH)
    img+=(np.array([0.025,0.035,0.085])+np.array([0.05,0.08,0.20])*np.clip(1-r*1.5,0,1)[...,None])
    bg=np.zeros_like(img); draw_pillars(z,bg,clamp(1.6-z*0.3)); img+=bg
    # back layers: big rotating flake + ring
    fl=np.zeros((FH,FW),np.float32); ln=np.zeros((FH,FW),np.float32)
    pb=clamp((t-1.5)/1.0)
    if pb>0:
        draw_flake((cx,cy,R*1.75,-rot*0.7+math.radians(30)),1.15*eout(pb),1,fl,ln)
        back=shade_flake(fl,ln,(cx,cy,R*1.75,0),0.22)
        img+=cv2.GaussianBlur(back,(0,0),2.5)
    lay=np.zeros_like(img)
    draw_ring((cx,cy,R,rot),eout((t-1.0)/1.2),lay,0.85)
    draw_vines((cx,cy,R,rot*0.25),eout((t-1.1)/1.3,2),lay,0.9)
    heads=draw_conv_vines((cx,cy,R,rot),t,lay,1.0)
    for (hx,hy) in heads:
        cv2.circle(lay,(int(hx*SC),int(hy*SC)),int(7*SC),tuple(float(c) for c in WHITE),-1,cv2.LINE_AA,SH4)
    img+=lay+cv2.GaussianBlur(lay,(0,0),5)*0.9
    # main flake
    fl[:]=0; ln[:]=0
    pg=1.15*eout((t-1.28)/(TB-1.28),2)
    draw_flake((cx,cy,R,rot),pg,0,fl,ln)
    sweep=None
    if 2.2<t<3.1: sweep=-0.3+(t-2.2)/0.9*1.9
    main=shade_flake(fl,ln,(cx,cy,R,rot),1.0,sweep)
    pulse=1+0.3*math.exp(-((t-TB)/0.12)**2)
    img+=cv2.GaussianBlur(main,(0,0),max(3,R*0.04))*0.9*pulse+cv2.GaussianBlur(main,(0,0),2)*0.4+main
    # burst fx
    fx=np.zeros_like(img)
    shockwave((cx,cy,R,rot),t-TB,fx,1.0)
    shards((cx,cy,R,rot),t-TB,fx,0.9)
    if t>T_dive: shards((cx,cy,R*0.25,rot),(t-T_dive)*1.3,fx,1.0,streak=3.0)
    snowfall(t,fx,zoom=max(1.0,z*0.6),k=0.9)
    img+=fx+cv2.GaussianBlur(fx,(0,0),4)*1.2
    # foreground out-of-focus flakes passing camera during push-in
    if 1.8<t<T_cut:
        fg=np.zeros((FH,FW),np.float32); l2=np.zeros((FH,FW),np.float32)
        u=(t-1.8)/(T_cut-1.8)
        for (ox,oy,s,ph) in ((-0.55,-0.30,1.0,0.0),(0.62,0.38,0.8,1.3)):
            ex=FW/2+ox*FW*(1+2.5*u); ey=FH/2+oy*FH*(1+2.0*u)
            draw_flake((ex,ey,260*s*(1+1.5*u),rot*1.5+ph),1.15,1,fg,l2)
        f=shade_flake(fg,l2,(FW/2,FH/2,600,0),0.35)
        img+=cv2.GaussianBlur(f,(0,0),14)
    # vignette + flash to white at cut
    vig=np.clip(1-(np.hypot((_xx-FW/2)/FW,(_yy-FH/2)/FH)**2)*1.2,0.3,1)[...,None]
    img*=vig
    fl_k=math.exp(-((t-TB)/0.06)**2)*0.12+clamp((t-(T_cut-0.25))/0.25)**2*1.4
    img+=fl_k*np.array([0.85,0.92,1.0])
    return img
