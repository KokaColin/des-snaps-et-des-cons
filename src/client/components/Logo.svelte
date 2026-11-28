<script lang="ts">
  // Logo graffiti validé (maquette Salon) : explosion violette à bord rose, SNAPS jaune / CONS rose.
  // Le logo fait 362 px de large : il se réduit pour tenir dans les écrans étroits.
  let { max = 1 }: { max?: number } = $props();
  let available = $state(362);
  const scale = $derived(Math.min(max, available / 362));
  const snaps: [string, number, number][] = [
    ['S', 72, -6],
    ['N', 58, 4],
    ['A', 66, -3],
    ['P', 56, 6],
    ['S', 74, -4],
  ];
  const cons: [string, number, number][] = [
    ['C', 76, 5],
    ['O', 60, -5],
    ['N', 68, 3],
    ['S', 80, -4],
  ];
</script>

<div class="fit" bind:clientWidth={available}>
<div class="frame" style:height="{128 * scale}px" style:width="{362 * scale}px">
  <div class="logo" style:transform="scale({scale})" role="img" aria-label="Des Snaps et des Cons">
    <svg width="362" height="128" viewBox="0 0 362 128" aria-hidden="true">
      <polygon
        points="357.0,64.0 314.8,74.6 339.6,90.5 282.8,92.1 290.7,111.7 243.6,109.1 220.2,123.5 181.0,111.6 141.8,123.5 124.5,104.7 71.3,111.7 68.2,95.2 22.4,90.5 47.2,74.6 5.0,64.0 54.0,54.0 22.4,37.5 68.2,32.8 71.3,16.3 121.4,21.1 141.8,4.5 181.0,18.9 220.2,4.5 243.6,18.9 290.7,16.3 288.3,34.3 339.6,37.5 308.0,54.0"
        fill="#2b1340"
        stroke="#ff4d8d"
        stroke-width="2.5"
      />
    </svg>
    <span class="word snaps" aria-hidden="true">
      {#each snaps as [l, size, r]}<span style:font-size="{size}px" style:transform="rotate({r}deg)">{l}</span>{/each}
    </span>
    <span class="word cons" aria-hidden="true">
      {#each cons as [l, size, r]}<span style:font-size="{size}px" style:transform="rotate({r}deg)">{l}</span>{/each}
    </span>
    <span class="amp" aria-hidden="true">&amp;</span>
    <span class="des d1" aria-hidden="true">des</span>
    <span class="des d2" aria-hidden="true">des</span>
  </div>
</div>
</div>

<style>
  .fit {
    width: 100%;
    display: flex;
    justify-content: center;
    flex: none;
  }
  .frame {
    position: relative;
    flex: none;
  }
  .logo {
    position: absolute;
    left: 0;
    top: 0;
    width: 362px;
    height: 128px;
    transform-origin: 0 0;
  }
  svg {
    position: absolute;
    left: -6px;
    top: 0;
  }
  .word {
    position: absolute;
    display: flex;
    align-items: flex-end;
    font-family: var(--bangers);
    line-height: 0.9;
    -webkit-text-stroke: 8px #000;
    paint-order: stroke fill;
  }
  .word span {
    display: inline-block;
  }
  .snaps {
    left: 26px;
    top: 14px;
    color: var(--yellow);
    text-shadow: 5px 5px 0 var(--pink);
    transform: skew(-10deg) rotate(-7deg);
  }
  .cons {
    left: 186px;
    top: 42px;
    color: var(--pink);
    text-shadow: -5px 5px 0 var(--yellow);
    transform: skew(-10deg) rotate(5deg);
  }
  .amp {
    position: absolute;
    left: 152px;
    top: 54px;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--bangers);
    font-size: 24px;
    clip-path: polygon(50% 0%, 61% 17%, 83% 7%, 79% 29%, 100% 32%, 85% 49%, 99% 68%, 77% 71%, 82% 94%, 61% 83%, 49% 100%, 38% 82%, 15% 93%, 22% 70%, 0% 64%, 16% 47%, 2% 28%, 23% 27%, 19% 5%, 39% 17%);
  }
  .des {
    position: absolute;
    padding: 2px 7px;
    background: var(--bg);
    color: var(--paper);
    border: 2px solid var(--paper);
    font-weight: 600;
    font-size: 14px;
  }
  .d1 {
    left: 12px;
    top: 4px;
    transform: rotate(-10deg);
  }
  .d2 {
    left: 196px;
    top: 30px;
    transform: rotate(8deg);
  }
</style>
