// Vue.js template configuration
module.exports = {
  name: 'vue',
  displayName: 'Vue.js Application',
  description: 'Template for Vue.js applications with Vue Router and Vuex',
  icon: 'vue-logo.png',
  buildCommand: 'npm run build',
  startCommand: 'npm run serve',
  defaultPort: 8080,
  dependencies: [
    'vue',
    'vue-router',
    'vuex',
    'axios'
  ],
  devDependencies: [
    '@vue/cli-service',
    '@vue/cli-plugin-babel',
    '@vue/cli-plugin-eslint',
    '@vue/cli-plugin-router',
    '@vue/cli-plugin-vuex'
  ],
  files: [
    {
      path: 'src/main.js',
      content: `import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'

Vue.config.productionTip = false

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
`
    },
    {
      path: 'src/App.vue',
      content: `<template>
  <div id="app">
    <nav>
      <router-link to="/">Home</router-link> |
      <router-link to="/about">About</router-link>
    </nav>
    <router-view/>
  </div>
</template>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

nav {
  padding: 30px;
}

nav a {
  font-weight: bold;
  color: #2c3e50;
}

nav a.router-link-exact-active {
  color: #42b983;
}
</style>
`
    },
    {
      path: 'src/router/index.js',
      content: `import Vue from 'vue'
import VueRouter from 'vue-router'
import HomeView from '../views/HomeView.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/AboutView.vue')
  }
]

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  routes
})

export default router
`
    },
    {
      path: 'src/store/index.js',
      content: `import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
  },
  getters: {
  },
  mutations: {
  },
  actions: {
  },
  modules: {
  }
})
`
    },
    {
      path: 'src/views/HomeView.vue',
      content: `<template>
  <div class="home">
    <img alt="Vue logo" src="../assets/logo.png">
    <h1>Welcome to Your Vue.js App</h1>
    <p>
      This application was deployed using DeployMaster.
    </p>
  </div>
</template>

<script>
export default {
  name: 'HomeView',
  components: {
  }
}
</script>
`
    },
    {
      path: 'src/views/AboutView.vue',
      content: `<template>
  <div class="about">
    <h1>About This App</h1>
    <p>
      This is a Vue.js application template provided by DeployMaster.
      It includes Vue Router for navigation and Vuex for state management.
    </p>
  </div>
</template>
`
    }
  ],
  dockerConfig: {
    baseImage: 'node:16-alpine',
    exposedPort: 8080,
    healthCheckPath: '/',
    environmentVariables: [
      'NODE_ENV=production'
    ]
  }
}
