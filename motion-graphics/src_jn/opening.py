# Jin opening: storybook theatre — curtains part, a white rose blooms, thorned vines spread
import numpy as np, cv2, math, sys, os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from lib import FW,FH,clamp,eio,eout,_yy,_xx
from fx import Canvas,LineLayer,Cam,R2,ob,mix,star4,bezier
def catmull(pts,n=18):
    P=np.array(pts,float); P=np.vstack([P[0],P,P[-1]]); out=[]
    for i in range(1,len(P)-2):
        p0,p1,p2,p3=P[i-1],P[i],P[i+1],P[i+2]
        for t in np.linspace(0,1,n,endpoint=False):
            t2,t3=t*t,t*t*t
            out.append(0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3))
    out.append(P[-2]); return np.array(out)

# ---------------- palette ----------------
CRIM=(0.55,0.05,0.10); CRIM_D=(0.24,0.02,0.05); CRIM_DD=(0.12,0.01,0.03); CRIM_L=(0.86,0.30,0.38)
ROSE_P=(0.93,0.62,0.68); BLK=(0.05,0.015,0.025); WHT=(0.97,0.95,0.95); SHADE=(0.80,0.74,0.77); EDGE=(0.48,0.36,0.42)
CANDLE=(1.0,0.80,0.50); SILV=(0.82,0.80,0.85)

# ---------------- rose ----------------
def petal_shape(L,W,n=26):
    ph=np.linspace(math.pi,0,n)
    r=1+0.10*np.exp(-((ph-math.pi/2)/0.22)**2)-0.05*np.exp(-((ph-math.pi*0.3)/0.12)**2)
    top=np.stack([W/2*np.cos(ph)*r, L*0.55+L*0.45*np.sin(ph)*r],1)
    u=np.sin(np.linspace(0,math.pi/2,9)[:-1])
    sl=np.stack([-0.14*W+(-W/2+0.14*W)*u, np.linspace(0,L*0.55,9)[:-1]],1)
    return np.vstack([sl,top,(sl*[-1,1])[::-1]])
PET_O=petal_shape(1,1)
PET_HI=petal_shape(0.80,0.74)*[1,1]+[0,0.20]
PET_LIP=(lambda p: p[9:9+24])(petal_shape(0.92,0.86))+[0,0.06]
def _xfp(shape,W,L,ang,cx,cy,tilt):
    pts=shape*[W,L]; pts=pts*[1,-1]
    w=pts@R2(ang).T; w[:,1]*=tilt; return w+[cx,cy]
GAP=(0.16,0.015,0.04); RIM=(0.88,0.12,0.20)
def crescent(phi,span,r,thick,facets=None,bulge=0.04,n=30):
    """petal = crescent: outer arc radius r, inner edge pulled in by `thick` at the middle"""
    m=facets or n
    u=np.linspace(0,1,m); th=phi+u*span
    ro=r*(1+bulge*np.sin(np.pi*u))
    if facets:   # angular outer edge like the logo petals
        ro=ro*(1+0.06*((np.arange(m)%2)*2-1)*np.sin(np.pi*u))
    outer=np.stack([np.cos(th)*ro,np.sin(th)*ro],1)
    ui=np.linspace(1,0,n); thi=phi+ui*span
    ri=r*(1-thick*np.sin(np.pi*ui)**0.8)
    inner=np.stack([np.cos(thi)*ri,np.sin(thi)*ri],1)
    return np.vstack([outer,inner])
GOLD=math.radians(137.5)
def rose_petals(small=False):
    P=[]
    if not small:
        for k in range(5):   # outer blocky ring
            P.append((crescent(math.radians(-90+k*72-52),math.radians(104),1.0 if k%2==0 else 0.94,0.42,facets=7),0.42+0.02*k))
        for i in range(8):   # inner spiral of cupped crescents
            f=i/7; r=0.80-0.60*f
            P.append((crescent(math.radians(30)+i*GOLD,math.radians(205-25*f),r,0.34+0.1*f),0.30-0.035*i))
    else:
        for k in range(5):
            P.append((crescent(math.radians(-90+k*72-50),math.radians(100),1.0,0.45,facets=6),0.15))
        for i in range(4):
            f=i/3; r=0.70-0.45*f
            P.append((crescent(math.radians(20)+i*GOLD,math.radians(210),r,0.40),0.10-0.03*i))
    return P
PET_BIG=rose_petals(False); PET_SMALL=rose_petals(True)
def rose(cv,cam,x,y,R,t0,t,burst=0.0,tilt=0.94,small=False,fill=WHT,gap=GAP,rim=RIM):
    petals=PET_SMALL if small else PET_BIG
    gw=max(1,int(R*(0.065 if small else 0.042)*cam.z)); rw=max(1,int(R*0.022*cam.z))
    polys=[]
    for idx,(poly,d) in enumerate(petals):
        p=(t-t0-d)/0.55
        if p<=0: polys.append(None); continue
        e=ob(p,1.3); rot=(1-eout(p))*-1.0; sc=R*e; off=np.zeros(2)
        if burst>0:
            c=poly.mean(0); nrm=np.linalg.norm(c)+1e-6; dirv=c/nrm if nrm>1e-3 else np.array([0,-1.0])
            off=dirv*R*burst*(4+idx*0.45); rot+=burst*(1.4+idx*0.3)*(1 if idx%2 else -1); sc*=1+burst*1.5
        q=(poly@R2(rot).T)*sc+off; q[:,1]*=tilt
        polys.append(cam.P(q+[x,y]))
    outer=[P for P,(poly,d) in zip(polys,petals[:5]) if P is not None]
    for P in outer: cv.lines(P,rim,gw+2*rw,True)
    pb=(t-t0-0.32)/0.5
    if pb>0 and burst<0.12:   # base disc so no holes show through the centre
        rb=R*0.62*ob(pb)*(1-burst*8)
        if rb>1:
            ang=np.linspace(0,2*math.pi,48); cv.poly(cam.P(np.stack([np.cos(ang)*rb,np.sin(ang)*rb*tilt],1)+[x,y]),fill)
    for P in polys:
        if P is None: continue
        cv.poly(P,fill); cv.lines(P,gap,gw,True)
    p=(t-t0-0.0)/0.5
    if p>0 and burst<0.15:
        e=ob(p); rc=R*(0.17 if not small else 0.20)*e*(1-burst*6.5)
        if rc>1:
            ang=np.linspace(0,2*math.pi,40); disc=np.stack([np.cos(ang)*rc,np.sin(ang)*rc*tilt],1)+[x,y]
            cv.poly(cam.P(disc),fill)
            th=np.linspace(0,math.pi*2.6*clamp(p*1.2),50)+t*0.35; r=rc*(0.10+0.85*np.linspace(0,1,50))
            cv.lines(cam.P(np.stack([np.cos(th)*r,np.sin(th)*r*tilt],1)+[x,y]),gap,gw,False)

# ---------------- thorned vines ----------------
VINES=[catmull([(-85.5, 234.9), (-289.0, 155.8), (-395.7, -93.8), (-278.2, -397.3), (65.4, -559.5), (479.3, -426.6), (720.0, -0.0)]),
       catmull([(88.9, 244.3), (302.2, 162.9), (415.2, -98.4), (292.5, -417.8), (-68.9, -589.3), (-505.5, -449.8), (-760.0, 0.0)]),
       catmull([(-281.9, -102.6), (-230.9, -310.2), (-27.5, -472.5), (280.0, -485.0), (577.9, -290.2), (728.4, 85.1), (628.2, 527.1)]),
       catmull([(281.9, -102.6), (230.9, -310.2), (27.5, -472.5), (-280.0, -485.0), (-577.9, -290.2), (-728.4, 85.1), (-628.2, 527.1)]),
       catmull([(-20, 300), (-160, 520), (-380, 640), (-520, 820), (-700, 900)]),
       catmull([(20, 320), (170, 540), (390, 660), (540, 840), (720, 920)])]
VSTART=[1.05,1.12,1.22,1.30,0.95,1.0]
STEM=catmull([(0,40),(10,220),(-15,420),(5,620),(0,900)])
def vine(cv,cam,V,p,width,thorn=True,burst=0.0):
    n=int(len(V)*p)
    if n<2: return None
    pts=V[:n]
    w=np.linspace(width,width*0.35,len(V))[:n]
    for i in range(n-1):
        cv.lines(cam.P(pts[i:i+2]),BLK,max(1,int(w[i]*cam.z)))
    # crimson highlight
    hl=pts+np.array([w[0]*0.18,-w[0]*0.18])
    for i in range(0,n-2,2): cv.lines(cam.P(hl[i:i+3]),CRIM,max(1,int(w[i]*0.22*cam.z)))
    if thorn:
        for i in range(4,n-1,7):
            d=V[i+1]-V[i]; d/=np.linalg.norm(d)+1e-9; nr=np.array([-d[1],d[0]])*(1 if (i//7)%2 else -1)
            age=clamp((n-i)/10); L=(26+14*((i*37)%5)/5)*ob(age)
            base=V[i]; tri=[base-d*9,base+nr*(w[i]*0.5+L)+d*10,base+d*7]
            cv.poly(cam.P(tri),BLK)
            cv.lines(cam.P([base+nr*w[i]*0.5,base+nr*(w[i]*0.5+L)+d*7]),CRIM_D,1)
        for i in range(10,n-2,23):    # leaves
            d=V[i+1]-V[i]; ang=math.atan2(d[1],d[0])+(1.1 if (i//23)%2 else -1.1)
            leafp(cv,cam,V[i],58*ob(clamp((n-i)/12)),ang)
    return pts[-1]
def leafp(cv,cam,pos,L,ang):
    if L<1: return
    u=np.linspace(0,1,16); w=L*0.42*np.sin(np.pi*u)**0.8
    A=np.vstack([np.stack([L*u,w],1),np.stack([L*u,np.zeros_like(u)],1)[::-1]])
    B=np.vstack([np.stack([L*u,np.zeros_like(u)],1),np.stack([L*u,-w],1)[::-1]])
    Rm=R2(ang)
    cv.poly(cam.P(A@Rm.T+pos),(0.10,0.03,0.05)); cv.poly(cam.P(B@Rm.T+pos),(0.20,0.04,0.07))
    cv.lines(cam.P(np.array([[0,0],[L*0.85,0]])@Rm.T+pos),CRIM,1)

# ---------------- theatre set ----------------
def harlequin(img,cam,k=1.0):
    cv=Canvas(); s=95*cam.z
    ox=(cam.cx)%(s*2); oy=(cam.cy)%(s*2)
    for j in range(-2,int(FH/s)+3):
        for i in range(-2,int(FW/(s*2))+3):
            x=i*s*2+ (s if j%2 else 0)-ox; y=j*s-oy
            col=CRIM_D if (i+j)%2 else CRIM_DD
            cv.poly([(x,y-s),(x+s,y),(x,y+s),(x-s,y)],col)
            cv.lines([(x,y-s),(x+s,y),(x,y+s),(x-s,y)],(0.30,0.04,0.07),1,True)
    cv.comp(img,k)
CITY=[(-300,0),(-300,-120),(-280,-120),(-280,-200),(-262,-240),(-244,-200),(-244,-110),(-210,-110),(-210,-170),(-190,-170),(-190,-130),
      (-150,-130),(-150,-260),(-140,-260),(-130,-330),(-120,-260),(-110,-260),(-110,-150),(-70,-150),(-70,-100),(-30,-100),(-30,-210),
      (-10,-210),(0,-290),(10,-210),(30,-210),(30,-120),(70,-120),(70,-180),(80,-180),(90,-230),(100,-180),(110,-180),(110,-90),(160,-90),
      (160,-200),(175,-240),(190,-200),(190,-140),(230,-140),(230,-250),(240,-250),(250,-300),(260,-250),(270,-250),(270,-110),(300,-110),(300,0)]
def arches(cv,cam,t):
    for (ax,aw,ah,moon) in ((-330,170,520,False),(0,230,640,True),(330,170,520,False)):
        base=-120; c=cam.P
        # window glow gradient approximated by 3 nested arches
        for k,col in enumerate(((0.36,0.06,0.10),(0.55,0.14,0.18),(0.75,0.32,0.34))):
            sh=1-k*0.12
            ang=np.linspace(math.pi,0,24)
            top=np.stack([ax+np.cos(ang)*aw/2*sh,base-ah+aw/2+(-np.sin(ang))*aw/2*sh*1.2],1)
            pts=np.vstack([[ax-aw/2*sh,base],top,[ax+aw/2*sh,base]])
            cv.poly(c(pts),col)
        if moon:
            m=c([[ax+40,base-ah+170]])[0]; r=46*cam.z
            cv.circle(m,r,(0.98,0.90,0.86)); cv.circle(m+np.array([18,-10])*cam.z,r*0.9,(0.75,0.32,0.34))
        city=np.array(CITY,float)*[aw/600,1.0*ah/640]+[ax,base]
        cv.poly(c(city),BLK)
        # gothic frame
        ang=np.linspace(math.pi,0,24)
        top=np.stack([ax+np.cos(ang)*aw/2,base-ah+aw/2-np.sin(ang)*aw/2*1.2],1)
        cv.lines(c(np.vstack([[ax-aw/2,base+40],top,[ax+aw/2,base+40]])),(0.08,0.02,0.03),max(1,int(16*cam.z)))
        cv.lines(c(np.vstack([[ax-aw/2,base+40],top,[ax+aw/2,base+40]])),(0.45,0.10,0.14),max(1,int(3*cam.z)))
        cv.lines(c([[ax,base-ah+aw/2-aw*0.6],[ax,base+40]]),(0.08,0.02,0.03),max(1,int(8*cam.z)))
def chandelier(cv,glow,x,top,L,t,ph,s=1.0):
    a=math.radians(3.0*math.sin(t*1.3+ph)); hx=x+math.sin(a)*L; hy=top+math.cos(a)*L
    cv.lines([(x,top),(hx,hy)],(0.08,0.02,0.03),2)
    body=[(hx-10*s,hy),(hx+10*s,hy),(hx+16*s,hy+40*s),(hx,hy+70*s),(hx-16*s,hy+40*s)]
    cv.poly(body,(0.10,0.03,0.04)); cv.lines(body,(0.55,0.20,0.22),1,True)
    for k in range(-2,3):
        ex=hx+k*34*s; ey=hy+30*s+abs(k)*-6*s
        cv.lines([(hx,hy+38*s),(hx+k*17*s,hy+48*s),(ex,ey)],(0.12,0.03,0.04),3)
        cv.poly([(ex-4*s,ey),(ex+4*s,ey),(ex+4*s,ey-16*s),(ex-4*s,ey-16*s)],(0.92,0.86,0.80))
        f=ey-22*s; fl=1+0.15*math.sin(t*9+k*1.7+ph)
        cv.poly([(ex,f-9*s*fl),(ex+4*s,f),(ex,f+4*s),(ex-4*s,f)],CANDLE)
        glow.circle((ex,f),26*s*fl,(0.9,0.5,0.25))
        for d in (-1,1):
            cv.poly([(hx+d*k*9*s,hy+78*s+abs(k)*5*s),(hx+d*k*9*s+4*s,hy+86*s+abs(k)*5*s),(hx+d*k*9*s,hy+96*s+abs(k)*5*s),(hx+d*k*9*s-4*s,hy+86*s+abs(k)*5*s)],(0.85,0.75,0.80))
def curtains(cv,t,open_):
    """side drapes slide apart; valance stays"""
    for side in (-1,1):
        edge=FW/2+side*(FW/2)*open_*0.86            # inner edge x
        outer=0 if side<0 else FW
        nf=7
        for k in range(nf):
            f0=k/nf; f1=(k+1)/nf
            x0=outer+(edge-outer)*f0; x1=outer+(edge-outer)*f1
            wv=12*math.sin(t*1.5+k)
            ys=np.linspace(130,FH,20)
            sway=np.sin(ys/180+t*1.2+k)*6*(1-open_*0.5)
            left=np.stack([x0+sway,ys],1); right=np.stack([x1+sway+wv*(ys/FH),ys],1)[::-1]
            col=CRIM if k%2==0 else (0.40,0.03,0.07)
            cv.poly(np.vstack([left,right]),col)
            cv.lines(np.stack([(x0+x1)/2+sway*1.2,ys],1),(0.70,0.12,0.18),2)
        # tie-back bunching shadow line at the inner edge
        ys=np.linspace(130,FH,20); cv.lines(np.stack([np.full_like(ys,edge),ys],1),(0.08,0.01,0.02),4)
    # valance with scallops
    cv.poly([(0,0),(FW,0),(FW,120),(0,120)],(0.40,0.03,0.07))
    for i in range(9):
        cx=i*FW/8; ang=np.linspace(0,math.pi,20)
        pts=np.stack([cx+np.cos(ang)*FW/16,120+np.sin(ang)*58],1)
        cv.poly(np.vstack([[cx+FW/16,110],pts,[cx-FW/16,110]]),CRIM)
        cv.lines(pts,(0.86,0.70,0.55),2)
        cv.poly([(cx-5,170),(cx+5,170),(cx,196)],(0.86,0.70,0.55))
    cv.lines([(0,118),(FW,118)],(0.86,0.70,0.55),3)

# ---------------- starburst & cards & petals ----------------
rng=np.random.default_rng(41)
RAYS=[dict(a=i*360/26+rng.uniform(-4,4),w=rng.uniform(4,10),L=rng.uniform(2.8,5.0),c=[CRIM,CRIM_L,WHT,BLK,ROSE_P,(0.35,0.03,0.07)][i%6]) for i in range(26)]
RAYS2=[dict(a=i*360/18+7+rng.uniform(-3,3),w=rng.uniform(3,6),L=rng.uniform(1.6,2.4),c=[WHT,ROSE_P,CRIM_L][i%3]) for i in range(18)]
def starburst(cv,cam,R,k,rot):
    if k<=0: return
    for r_ in RAYS+RAYS2:
        a=math.radians(r_['a'])+rot; w=math.radians(r_['w'])
        L=R*r_['L']*eout(k)
        pts=[(math.cos(a-w)*R*0.5,math.sin(a-w)*R*0.5),(math.cos(a)*L,math.sin(a)*L),(math.cos(a+w)*R*0.5,math.sin(a+w)*R*0.5)]
        cv.poly(cam.P(pts),r_['c'])
CARDS=[dict(p0=np.array(rng.uniform([-700,300],[-300,900])),v=np.array(rng.uniform([280,-520],[520,-300])),t0=rng.uniform(1.9,2.5),
            spin=rng.uniform(-1.5,1.5),flip=rng.uniform(2,5),ph=rng.uniform(0,6)) for _ in range(7)]
def card(cv,cam,c,ang,flipc,s=1.0):
    w=46*s*max(0.08,abs(flipc)); h=66*s
    Rm=R2(ang)
    def P(pts): return cam.P(np.asarray(pts)@Rm.T+c)
    cv.poly(P([(-w,-h),(w,-h),(w,h),(-w,h)]),WHT if flipc>0 else (0.70,0.08,0.12))
    cv.lines(P([(-w*0.86,-h*0.9),(w*0.86,-h*0.9),(w*0.86,h*0.9),(-w*0.86,h*0.9)]),CRIM,1,True)
    if flipc>0:
        cv.circle(P([(0,0)])[0],12*s*abs(flipc)*cam.z,CRIM)
        cv.circle(P([(0,0)])[0],6*s*abs(flipc)*cam.z,CRIM_L)
    else:
        for k in range(3):
            cv.lines(P([(-w*0.6,-h*0.5+k*h*0.5),(w*0.6,-h*0.5+k*h*0.5)]),(0.95,0.75,0.70),1)
PETALS=[dict(x=rng.uniform(-600,600),y=rng.uniform(-1100,900),v=rng.uniform(50,140),s=rng.uniform(10,22),
             ph=rng.uniform(0,6.3),sp=rng.uniform(-3,3),z=rng.uniform(0.7,1.8)) for _ in range(60)]
PCOL=[WHT,(0.72,0.06,0.13),(0.88,0.20,0.26),(0.50,0.03,0.08),(0.95,0.55,0.60)]
def petal_p(cv,cam,x,y,s,ang,col=None,idx=0):
    col=col or PCOL[idx%len(PCOL)]
    u=np.linspace(0,math.pi,14)
    pts=np.vstack([np.stack([np.cos(u)*s*0.55,np.sin(u)*s*0.9],1),np.stack([np.cos(u[::-1])*s*0.40,np.sin(u[::-1])*s*0.35],1)])
    Rm=R2(ang); cv.poly(cam.P(pts@Rm.T+[x,y]),col)
SPK_OFF=[dict(x=rng.uniform(40,FW-40),y=rng.uniform(150,FH-60),L=rng.uniform(8,40),ph=rng.uniform(0,6.3),
          sp=rng.uniform(1.4,3.0),c=[(1,0.92,0.80),WHT,ROSE_P][rng.integers(3)]) for _ in range(40)]
SPK=[]   # star sparkles removed on request

def background(t,cam_bg):
    img=np.zeros((FH,FW,3),np.float32)
    r=np.hypot((_xx-FW/2)/FW,(_yy-FH*0.45)/FH)
    img+=np.array(CRIM_DD,np.float32)+(np.array((0.30,0.03,0.07),np.float32)-np.array(CRIM_DD,np.float32))*np.clip(1-r*1.4,0,1)[...,None]
    harlequin(img,cam_bg,0.9)
    # arched windows removed on request
    return img

def opening(t,T_dive,T_cut):
    if t<2.2: z=0.88+0.12*eio(t/2.2)
    elif t<T_dive: z=1.0+0.42*eio((t-2.2)/(T_dive-2.2))
    else: z=1.42*math.exp(2.6*(t-T_dive)/(T_cut-T_dive))
    cx,cy=FW/2,FH*0.50
    cam=Cam(cx,cy,z,0.0); cam_bg=Cam(cx,cy-60,z**0.5,0.0)
    img=background(t,cam_bg)
    burst=eio((t-T_dive)/(T_cut-T_dive)) if t>T_dive else 0.0
    # chandeliers (mid layer)
    ch=Canvas(); gl=Canvas()
    zc=z**0.7
    for (x,L,ph,s) in ((210,150,0.0,1.0),(870,130,1.7,0.95)):
        chandelier(ch,gl,cx+(x-cx)*zc,100-(zc-1)*300,L*zc,t,ph,s*zc*1.25)
    glow=gl.rgb.astype(np.float32)/255
    img+=cv2.GaussianBlur(glow,(0,0),24)*0.9
    ch.comp(img)
    # spotlight
    sp=eout((t-0.45)/0.6)
    if sp>0:
        cone=np.clip(1-np.abs(_xx-cx)/(90+(_yy/FH)*520),0,1)**1.5*np.clip(_yy/FH*1.3,0,1)
        img+=cone[...,None]*np.array([1.0,0.80,0.80],np.float32)*0.16*sp
        img+=np.exp(-np.hypot(_xx-cx,(_yy-cy)*1.5)/260)[...,None]*np.array([1,0.75,0.75],np.float32)*0.25*sp
    # starburst rays behind the rose
    sb=Canvas(); starburst(sb,cam,170,clamp((t-1.65)/0.9),0.05*t+burst*0.6)
    sb.comp(img,0.88)
    # vines, stem, rose
    cv=Canvas()
    # cards
    for c in CARDS:
        u=t-c['t0']
        if u<=0: continue
        pos=c['p0']+c['v']*u+np.array([0,60*u*u]); ang=c['spin']*u+c['ph']
        if burst<0.25: card(cv,Cam(cx,cy,z**1.2,0),pos,ang,math.cos(c['flip']*u+c['ph']),1.0)
    stem_p=eout((t-0.55)/0.6)
    vine(cv,cam,STEM,stem_p,28,thorn=True)
    ends=[]
    for V,ts in zip(VINES,VSTART):
        p=eout((t-ts)/1.1,2)
        e=vine(cv,cam,V*(1+burst*2.0),p,24)
        ends.append((e,p,ts))
    for i,(e,p,ts) in enumerate(ends):
        if e is not None and p>0.98 and i<4:
            rose(cv,cam,e[0],e[1],78,ts+1.0,t,burst*0.8,small=True,fill=(0.62,0.06,0.12),gap=(0.10,0.01,0.03),rim=(1.0,0.35,0.42))
    rc=Canvas(); rose(rc,cam,0,0,235,0.85,t,burst)
    # foreground rose bushes (depth layer)
    fb=Canvas(); camf=Cam(cx,cy,z**1.5,0)
    for (bx,by,ph) in ((-470,760,0.0),(480,780,0.15)):
        for k in range(7):
            a=math.radians(-160+k*50+ph*100); leafp(fb,camf,np.array([bx,by]),120*ob((t-1.2-k*0.03)/0.6),a)
        for (dx,dy,rr,dd) in ((0,0,120,0.0),(-130*np.sign(bx),-90,90,0.12),(110*np.sign(bx)*-1,-150,70,0.22)):
            rose(fb,camf,bx+dx,by+dy,rr,1.25+dd+ph,t,burst*0.5,small=True,fill=(0.58,0.05,0.11) if dd>0 else WHT,gap=(0.10,0.01,0.03),rim=(1.0,0.35,0.42))
    # drifting petals
    for p_ in PETALS:
        if t<1.6: break
        y=(p_['y']+p_['v']*t)%2000-1000; x=p_['x']+30*math.sin(t+p_['ph'])
        petal_p(cv,Cam(cx,cy,z**p_['z'],0),x*(1+burst*1.5),y*(1+burst*1.5),p_['s']*(1+burst*2),p_['sp']*t,idx=int(p_['ph']*10))
    sh=cv2.GaussianBlur(cv.a.astype(np.float32)/255,(0,0),12)
    img*=1-0.5*sh[...,None]
    cv.comp(img)
    # main rose: glow rim, soft shadow, white petals with the stage faintly showing through
    ra=rc.a.astype(np.float32)/255; rr=rc.rgb.astype(np.float32)/255
    img+=cv2.GaussianBlur(ra,(0,0),22)[...,None]*np.array([0.9,0.08,0.16],np.float32)*0.55
    img*=1-0.45*cv2.GaussianBlur(ra,(0,0),14)[...,None]
    scene=img.copy()
    white=np.clip((rr.min(-1)-0.80)/0.15,0,1)*ra
    lum=scene.mean(-1,keepdims=True)
    tex=np.clip(1.0-0.22*(1-np.clip(lum*3.2,0,1)),0,1)*np.array([1,0.93,0.94],np.float32)
    rgb=rr*(1-white[...,None])+tex*white[...,None]
    img[...]=img*(1-ra[...,None])+rgb
    fsh=cv2.GaussianBlur(fb.a.astype(np.float32)/255,(0,0),20); img*=1-0.6*fsh[...,None]; fb.comp(img,1.0,blur=1.5)
    # rose glow
    img+=np.exp(-np.hypot(_xx-cx,_yy-cy)/(150*z))[...,None]*np.array([1,0.85,0.85],np.float32)*(0.18+1.6*burst)*clamp((t-1.2)/0.6)
    # sparkles
    add=Canvas()
    for s_ in SPK:
        k=max(0,math.sin(t*s_['sp']+s_['ph']))**3*clamp((t-0.8)/0.6)
        if k>0.02: star4(add,np.array([s_['x'],s_['y']]),s_['L']*(0.6+0.4*k),tuple(c*k for c in s_['c']))
    la=add.rgb.astype(np.float32)/255; img+=la+cv2.GaussianBlur(la,(0,0),6)*1.4
    # curtains in front (open 0.1..1.1s); valance fades with dive
    ct=Canvas(); curtains(ct,t,eio((t-0.1)/1.0)); ct.comp(img,1.0-burst)
    vig=np.clip(1-(np.hypot((_xx-FW/2)/FW,(_yy-FH/2)/FH)**2)*1.2,0.3,1)[...,None]
    img*=vig
    img+=(clamp((t-(T_cut-0.22))/0.22)**2*1.5)*np.array([1.0,0.92,0.92],np.float32)
    return img
