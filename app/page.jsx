import React from 'react'
import Navbar from './components/Navbar'
import Home from './components/Home'
import LogosPage from './components/LogoHome'
import HomeCatageory from './components/HomeTemplateCategories'
import BrandCategories from './components/HomeBrandsCatageory'
import TrendingLogos from './components/HomeTrendingLogo'
import TopBrands from './components/HomeTopBrand'
import Footer from './components/Footer'

function page() {
    return (
        <>
            <Navbar />
            <Home/>
            <LogosPage/>
            <BrandCategories/>
            <HomeCatageory/>
            <TrendingLogos/>
            <TopBrands/>
            <Footer/>
        </>
    )
}

export default page